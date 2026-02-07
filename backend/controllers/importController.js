const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
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

// Parse Excel files (.xlsx, .xls)
const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Use first sheet
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = Object.keys(jsonData[0]);
  return { headers, rows: jsonData };
};

// Parse CSV files
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const headers = new Set();
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headerList.forEach(h => headers.add(h));
      })
      .on('data', (data) => results.push(data))
      .on('end', () => resolve({ headers: Array.from(headers), rows: results }))
      .on('error', reject);
  });
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

    // Detect file type
    const fileExt = originalname.split('.').pop().toLowerCase();
    const source = fileExt === 'csv' ? 'csv' : 'xlsx';

    // 1. Create Import Job
    const jobResult = await client.query(
      `INSERT INTO import_jobs (tenant_id, source, filename, status, created_by)
       VALUES ($1, $2, $3, 'uploaded', $4) RETURNING id`,
      [tenantId, source, originalname, req.user.id]  // FIXED: Use req.user.id
    );
    const jobId = jobResult.rows[0].id;

    // 2. Parse File (CSV or Excel)
    const { headers, rows: results } = source === 'csv' 
      ? await parseCSV(filePath)
      : parseExcel(filePath);

    // 3. Save Columns
    const columnPromises = headers.map(header => {
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
        const { group_id, create_group, group_name } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;  // FIXED: Use req.user.id instead of req.user.userId

        console.log('Import process - Group data received:', { group_id, create_group, group_name });
        console.log('User ID:', userId, 'Tenant ID:', tenantId);

        await client.query('BEGIN');

        let targetGroupId = group_id;

        // Create group if requested
        if (create_group && group_name) {
            console.log('Creating new group:', group_name);
            try {
                const groupResult = await client.query(
                    `INSERT INTO contact_groups (tenant_id, name, created_by)
                     VALUES ($1, $2, $3) RETURNING id`,
                    [tenantId, group_name, userId]
                );
                targetGroupId = groupResult.rows[0].id;
                console.log('Group created with ID:', targetGroupId);
                
                // Update import job with group info
                await client.query(
                    `UPDATE import_jobs SET group_id = $1, create_group = true, group_name = $2 WHERE id = $3`,
                    [targetGroupId, group_name, id]
                );
            } catch (groupError) {
                // Check if it's a duplicate name error
                if (groupError.code === '23505' && groupError.constraint === 'unique_group_name_per_tenant') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ 
                        error: `A group named "${group_name}" already exists. Please choose a different name or select the existing group.` 
                    });
                }
                throw groupError; // Re-throw other errors
            }
        } else if (group_id) {
            console.log('Using existing group:', group_id);
            // Update import job with existing group
            await client.query(
                `UPDATE import_jobs SET group_id = $1, group_name = (
                    SELECT name FROM contact_groups WHERE id = $1
                ) WHERE id = $2`,
                [group_id, id]
            );
        } else {
            console.log('No group selected');
        }

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
        const importedContactIds = [];

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

            // FIXED: Add import_id to metadata so trigger knows it's an import
            contactData.metadata.import_id = id;

            try {
                // Insert Contact
                const contactResult = await client.query(
                    `INSERT INTO contacts (tenant_id, name, email, phone, company_name, source, metadata, updated_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [
                        contactData.tenant_id,
                        contactData.name,
                        contactData.email,
                        contactData.phone,
                        contactData.company_name,
                        contactData.source,
                        JSON.stringify(contactData.metadata),
                        userId
                    ]
                );
                importedContactIds.push(contactResult.rows[0].id);
                processed++;
            } catch (err) {
                console.error("Row error:", err);
                errors++;
                // Optionally save error to import_rows.validation_errors
            }
        }

        // Add contacts to group if specified
        if (targetGroupId && importedContactIds.length > 0) {
            const membershipPromises = importedContactIds.map(contactId =>
                client.query(
                    `INSERT INTO contact_group_memberships (group_id, contact_id, added_by)
                     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                    [targetGroupId, contactId, userId]
                )
            );
            await Promise.all(membershipPromises);
        }

        await client.query(
            `UPDATE import_jobs SET status = 'completed', processed_rows = $1, error_rows = $2 WHERE id = $3`,
            [processed, errors, id]
        );

        // Log import completion activity
        const groupInfo = targetGroupId 
            ? ` into group "${group_name || 'existing'}"` 
            : '';
        await client.query(
            `SELECT log_user_activity($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                tenantId, 
                userId, 
                'import', 
                'completed', 
                `Imported ${processed} contacts${groupInfo}`,
                'import_job',
                id,
                null  // resource_name
            ]
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
