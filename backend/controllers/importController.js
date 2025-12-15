const fs = require('fs');
const csv = require('csv-parser');
const { pool } = require('../config/db');

// Helper to normalize column names
const normalizeName = (name) => {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
};

// Detect column type (simple heuristic)
const detectType = (value) => {
  if (!value) return 'string';
  if (!isNaN(value)) return 'number';
  if (!isNaN(Date.parse(value))) return 'date';
  if (value.includes('@')) return 'email';
  return 'string';
};

exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { originalname, path: filePath } = req.file;
    const tenantId = req.user.tenantId; // Assumes authMiddleware adds user

    // 1. Create Import Job
    const jobResult = await client.query(
      `INSERT INTO import_jobs (tenant_id, source, filename, status, created_by)
       VALUES ($1, $2, $3, 'uploaded', $4) RETURNING id`,
      [tenantId, 'csv', originalname, req.user.userId]
    );
    const jobId = jobResult.rows[0].id;

    // 2. Parse CSV
    const results = [];
    const headers = new Set();
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
            headerList.forEach(h => headers.add(h));
        })
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    // 3. Save Columns
    const columnPromises = Array.from(headers).map(header => {
      const sampleValue = results[0] ? results[0][header] : null;
      return client.query(
        `INSERT INTO import_columns (import_job_id, original_name, normalized_name, detected_type)
         VALUES ($1, $2, $3, $4)`,
        [jobId, header, normalizeName(header), detectType(sampleValue)]
      );
    });
    await Promise.all(columnPromises);

    // 4. Save Rows (Batch insert could be optimized, but keeping simple for now)
    // Using JSONB for flexibility as requested
    const rowPromises = results.map((row, index) => {
      return client.query(
        `INSERT INTO import_rows (import_job_id, row_index, data)
         VALUES ($1, $2, $3)`,
        [jobId, index, JSON.stringify(row)]
      );
    });
    await Promise.all(rowPromises);

    // 5. Update Job Stats
    await client.query(
      `UPDATE import_jobs SET status = 'parsed', total_rows = $1 WHERE id = $2`,
      [results.length, jobId]
    );

    await client.query('COMMIT');
    
    // Cleanup file
    fs.unlinkSync(filePath);

    res.json({ message: 'File uploaded and parsed', jobId, totalRows: results.length });

  } catch (err) {
    await client.query('ROLLBACK');
    if (req.file) fs.unlinkSync(req.file.path); // Cleanup on error
    console.error(err);
    res.status(500).json({ error: 'Import failed' });
  } finally {
    client.release();
  }
};

exports.getJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const job = await pool.query('SELECT * FROM import_jobs WHERE id = $1', [id]);
        const columns = await pool.query('SELECT * FROM import_columns WHERE import_job_id = $1', [id]);
        
        if (job.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ job: job.rows[0], columns: columns.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch job status' });
    }
};

exports.saveMapping = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params; // Job ID
        const { mappings } = req.body; // { columnId: 'targetField', ... }

        await client.query('BEGIN');

        for (const [columnId, targetField] of Object.entries(mappings)) {
            await client.query(
                `UPDATE import_columns SET mapped_to = $1 WHERE id = $2 AND import_job_id = $3`,
                [targetField, columnId, id]
            );
        }

        await client.query(
            `UPDATE import_jobs SET status = 'mapped' WHERE id = $1`,
            [id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Mapping saved' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Failed to save mapping' });
    } finally {
        client.release();
    }
};

exports.processImport = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params; // Job ID
        const tenantId = req.user.tenantId;

        await client.query('BEGIN');

        // Get Mappings
        const columns = await client.query(
            `SELECT * FROM import_columns WHERE import_job_id = $1 AND mapped_to IS NOT NULL`,
            [id]
        );
        
        if (columns.rows.length === 0) {
            throw new Error("No columns mapped");
        }

        // Get Rows
        const rows = await client.query(
            `SELECT * FROM import_rows WHERE import_job_id = $1`,
            [id]
        );

        let processed = 0;
        let errors = 0;

        for (const row of rows.rows) {
            const contactData = {
                tenant_id: tenantId,
                source: 'import',
                metadata: {}
            };

            // Map data
            columns.rows.forEach(col => {
                const value = row.data[col.original_name];
                if (['name', 'email', 'phone', 'company_name'].includes(col.mapped_to)) {
                    contactData[col.mapped_to] = value;
                } else {
                    contactData.metadata[col.mapped_to] = value; // Custom fields go to metadata
                }
            });

            try {
                // Insert Contact
                await client.query(
                    `INSERT INTO contacts (tenant_id, name, email, phone, company_name, source, metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        contactData.tenant_id,
                        contactData.name,
                        contactData.email,
                        contactData.phone,
                        contactData.company_name,
                        contactData.source,
                        contactData.metadata
                    ]
                );
                processed++;
            } catch (err) {
                console.error("Row error:", err);
                errors++;
                // Optionally save error to import_rows.validation_errors
            }
        }

        await client.query(
            `UPDATE import_jobs SET status = 'completed', processed_rows = $1, error_rows = $2 WHERE id = $3`,
            [processed, errors, id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Import processed', processed, errors });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Processing failed' });
    } finally {
        client.release();
    }
};
