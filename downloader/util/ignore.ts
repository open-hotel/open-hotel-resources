import fs from 'fs'
import ig from 'ignore'
import { CONFIG } from '../config';

export const ignore = ig().add(fs.readFileSync(CONFIG.ignore).toString());
