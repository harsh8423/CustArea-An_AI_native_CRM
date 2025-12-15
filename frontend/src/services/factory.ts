import { ISTTService, ILLMService, ITTSService, IAvatarService } from './types';
import { AzureSTTService } from './stt/azureSttService';
import { GroqService } from './llm/groqService';
import { AzureTTSService } from './tts/azureTtsService';
import { LiveAvatarService } from './avatar/liveAvatarService';
import { NullAvatarService } from './avatar/nullAvatarService';

export interface ServiceConfig {
    useAvatar: boolean;
    // Future configs:
    // sttProvider: 'azure' | 'openai';
    // llmProvider: 'groq' | 'openai';
}

export const defaultConfig: ServiceConfig = {
    useAvatar: false, // Set to false to disable avatar
};

export class ServiceFactory {
    static createSTT(): ISTTService {
        return new AzureSTTService();
    }

    static createLLM(): ILLMService {
        return new GroqService();
    }

    static createTTS(): ITTSService {
        return new AzureTTSService();
    }

    static createAvatar(config: ServiceConfig = defaultConfig): IAvatarService {
        if (config.useAvatar) {
            return new LiveAvatarService();
        }
        return new NullAvatarService();
    }
}
