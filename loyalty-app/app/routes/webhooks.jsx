import { handleWebhook } from '../lib/webhooks-handler.server.js';

export const action = async (args) => handleWebhook(args);
