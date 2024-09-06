import { ConfigService } from '../services/humidity/config/ConfigService.js';
import type { Config } from '../types/config.d.ts';
export declare const settings: (config: Config | boolean, confService: ConfigService) => Promise<void>;
