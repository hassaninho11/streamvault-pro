/**
 * Subtitle Service - Detection, parsing, and AI generation
 */
import { 
  Subtitle, 
  SubtitleTrack, 
  SubtitleCue,
  SubtitleGenerationProgress,
  SubtitleGenerationResult 
} from '@/types/vod';

type ProgressCallback = (progress: SubtitleGenerationProgress) => void;

class SubtitleServiceClass {
  private progressCallbacks: Map<string, ProgressCallback[]> = new Map();
  
  /**
   * Parse VTT/SRT content to SubtitleTrack
   */
  parseSubtitle(content: string, format: 'vtt' | 'srt'): SubtitleTrack {
    const cues: SubtitleCue[] = [];
    
    if (format === 'vtt') {
      return this.parseVTT(content);
    } else {
      return this.parseSRT(content);
    }
  }
  
  private parseVTT(content: string): SubtitleTrack {
    const lines = content.split('\n');
    const cues: SubtitleCue[] = [];
    let i = 0;
    
    // Skip header
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line.includes('-->')) {
        const [startStr, endStr] = line.split('-->').map(s => s.trim());
        const startTime = this.parseTimeVTT(startStr);
        const endTime = this.parseTimeVTT(endStr);
        
        // Collect text lines
        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        
        if (textLines.length > 0) {
          cues.push({
            startTime,
            endTime,
            text: textLines.join('\n'),
          });
        }
      }
      i++;
    }
    
    return { language: 'unknown', languageCode: 'und', cues };
  }
  
  private parseSRT(content: string): SubtitleTrack {
    const blocks = content.split(/\n\n+/);
    const cues: SubtitleCue[] = [];
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      
      // Find timing line
      const timingLine = lines.find(l => l.includes('-->'));
      if (!timingLine) continue;
      
      const [startStr, endStr] = timingLine.split('-->').map(s => s.trim());
      const startTime = this.parseTimeSRT(startStr);
      const endTime = this.parseTimeSRT(endStr);
      
      // Get text (skip index and timing lines)
      const textStartIndex = lines.indexOf(timingLine) + 1;
      const text = lines.slice(textStartIndex).join('\n');
      
      if (text) {
        cues.push({ startTime, endTime, text });
      }
    }
    
    return { language: 'unknown', languageCode: 'und', cues };
  }
  
  private parseTimeVTT(timeStr: string): number {
    // Format: HH:MM:SS.mmm or MM:SS.mmm
    const parts = timeStr.split(':');
    let hours = 0, minutes = 0, seconds = 0;
    
    if (parts.length === 3) {
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
      seconds = parseFloat(parts[2]);
    } else if (parts.length === 2) {
      minutes = parseInt(parts[0], 10);
      seconds = parseFloat(parts[1]);
    }
    
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  private parseTimeSRT(timeStr: string): number {
    // Format: HH:MM:SS,mmm
    const normalized = timeStr.replace(',', '.');
    return this.parseTimeVTT(normalized);
  }
  
  /**
   * Convert SubtitleTrack to VTT format
   */
  toVTT(track: SubtitleTrack): string {
    let vtt = 'WEBVTT\n\n';
    
    track.cues.forEach((cue, index) => {
      vtt += `${index + 1}\n`;
      vtt += `${this.formatTimeVTT(cue.startTime)} --> ${this.formatTimeVTT(cue.endTime)}\n`;
      vtt += `${cue.text}\n\n`;
    });
    
    return vtt;
  }
  
  private formatTimeVTT(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(3);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.padStart(6, '0')}`;
  }
  
  /**
   * Detect available subtitles from stream
   */
  async detectSubtitles(streamUrl: string): Promise<Subtitle[]> {
    // In a real implementation, this would:
    // 1. Check HLS manifest for subtitle tracks
    // 2. Look for sidecar .srt/.vtt files
    // 3. Probe video for embedded subtitles
    
    // For now, return empty array - real implementation requires backend
    console.log('Detecting subtitles for:', streamUrl);
    return [];
  }
  
  /**
   * Start AI subtitle generation (Premium feature)
   */
  async generateSubtitle(
    vodItemId: string,
    streamUrl: string,
    targetLanguage: string = 'auto',
    onProgress?: ProgressCallback
  ): Promise<SubtitleGenerationResult> {
    // Register progress callback
    if (onProgress) {
      const callbacks = this.progressCallbacks.get(vodItemId) || [];
      callbacks.push(onProgress);
      this.progressCallbacks.set(vodItemId, callbacks);
    }
    
    try {
      // Notify: Queued
      this.notifyProgress(vodItemId, {
        vodItemId,
        status: 'queued',
        progress: 0,
        message: 'Undertextgenerering köad...',
      });
      
      // Simulate delay (real implementation would call backend)
      await this.delay(1000);
      
      // Notify: Extracting audio
      this.notifyProgress(vodItemId, {
        vodItemId,
        status: 'extracting_audio',
        progress: 10,
        message: 'Extraherar ljudspår...',
      });
      
      await this.delay(2000);
      
      // Notify: Transcribing
      this.notifyProgress(vodItemId, {
        vodItemId,
        status: 'transcribing',
        progress: 30,
        message: 'Transkriberar med AI...',
      });
      
      // In real implementation, this would:
      // 1. Extract audio from stream (FFmpeg or browser MediaRecorder)
      // 2. Send to Speech-to-Text API (Whisper, Google, etc.)
      // 3. Process and sync timestamps
      // 4. Generate VTT/SRT
      
      // For demo, generate sample subtitle
      await this.delay(3000);
      
      // Notify: Processing
      this.notifyProgress(vodItemId, {
        vodItemId,
        status: 'processing',
        progress: 80,
        message: 'Bearbetar tidskoder...',
      });
      
      await this.delay(1000);
      
      // Create demo subtitle
      const subtitle: Subtitle = {
        id: `sub_${vodItemId}_${Date.now()}`,
        vodItemId,
        language: targetLanguage === 'auto' ? 'Svenska' : targetLanguage,
        languageCode: targetLanguage === 'auto' ? 'sv' : targetLanguage,
        format: 'vtt',
        source: 'ai_generated',
        aiGenerated: true,
        content: this.generateDemoVTT(),
        createdAt: new Date(),
      };
      
      // Notify: Completed
      this.notifyProgress(vodItemId, {
        vodItemId,
        status: 'completed',
        progress: 100,
        message: 'Undertext skapad!',
      });
      
      return {
        vodItemId,
        subtitle,
        detectedLanguage: 'sv',
        confidence: 0.92,
      };
      
    } catch (error) {
      this.notifyProgress(vodItemId, {
        vodItemId,
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      // Clean up callbacks
      this.progressCallbacks.delete(vodItemId);
    }
  }
  
  private notifyProgress(vodItemId: string, progress: SubtitleGenerationProgress) {
    const callbacks = this.progressCallbacks.get(vodItemId) || [];
    callbacks.forEach(cb => cb(progress));
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private generateDemoVTT(): string {
    return `WEBVTT

1
00:00:01.000 --> 00:00:04.000
[AI-genererad undertext]

2
00:00:05.000 --> 00:00:10.000
Denna undertext skapades automatiskt
från ljudspåret med taligenkänning.

3
00:00:11.000 --> 00:00:15.000
Observera att AI-genererade undertexter
kan innehålla fel.
`;
  }
  
  /**
   * Apply subtitle delay offset
   */
  applyDelay(track: SubtitleTrack, delayMs: number): SubtitleTrack {
    const delaySeconds = delayMs / 1000;
    return {
      ...track,
      cues: track.cues.map(cue => ({
        ...cue,
        startTime: Math.max(0, cue.startTime + delaySeconds),
        endTime: Math.max(0, cue.endTime + delaySeconds),
      })),
    };
  }
  
  /**
   * Get current cue for a given time
   */
  getCurrentCue(track: SubtitleTrack, currentTime: number): SubtitleCue | null {
    return track.cues.find(cue => 
      currentTime >= cue.startTime && currentTime <= cue.endTime
    ) || null;
  }
}

export const SubtitleService = new SubtitleServiceClass();
