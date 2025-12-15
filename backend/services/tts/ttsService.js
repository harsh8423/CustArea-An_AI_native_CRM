const sdk = require('microsoft-cognitiveservices-speech-sdk');

class AzureTTS {
  constructor() {
    this.synth = null;
  }

  ensureSynth() {
    if (this.synth) return this.synth;

    const speechKey = process.env.SPEECH_KEY;
    const speechRegion = process.env.SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      throw new Error('Speech key or region missing');
    }

    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechSynthesisVoiceName = 'en-US-AvaNeural';
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;

    this.synth = new sdk.SpeechSynthesizer(speechConfig, null); // null for no local playback
    return this.synth;
  }

  async synthesizeToWavBytes(text) {
    const synth = this.ensureSynth();
    return new Promise((resolve, reject) => {
      synth.speakTextAsync(
        text,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(result.audioData);
          } else {
            reject(new Error('TTS canceled: ' + result.errorDetails));
          }
        },
        (err) => reject(err)
      );
    });
  }

  close() {
    if (this.synth) {
      this.synth.close();
      this.synth = null;
    }
  }
}

module.exports = { AzureTTS };
