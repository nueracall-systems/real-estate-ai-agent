import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
