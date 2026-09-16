import { defineStrategy } from '../kit.js';
import config from './config.js';
import { evaluate } from './model.js';

export const age20Strategy = defineStrategy(config, evaluate);
