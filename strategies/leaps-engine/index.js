import { defineStrategy } from '../kit.js';
import config from './config.js';
import { evaluate } from './model.js';

export const leapsEngineStrategy = defineStrategy(config, evaluate);
