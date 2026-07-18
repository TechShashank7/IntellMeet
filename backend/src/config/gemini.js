import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../lib/env.js';

const genAI = new GoogleGenerativeAI(ENV.GEMENI_API_KEY);

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
  },
});
