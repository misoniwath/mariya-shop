
import { GoogleGenAI } from "@google/genai";

// Prefer Vite-style env: VITE_GEMINI_API_KEY injected via import.meta.env
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey });

function extractText(response: any): string | undefined {
  // Try multiple shapes the SDK might use
  if (typeof response?.text === 'string') return response.text;
  if (typeof response?.output_text === 'string') return response.output_text;
  const candidate = response?.candidates?.[0];
  if (candidate?.content?.parts) {
    return candidate.content.parts.map((p: any) => p.text ?? '').join(' ').trim();
  }
  return undefined;
}

export const geminiService = {
  async generateDescription(productName: string): Promise<string> {
    try {
      const prompt = `Write a compelling, short marketing description (2-3 sentences) for a product named "${productName}". Target coffee shop owners or home enthusiasts.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config: {
          temperature: 0.7,
        },
      });

      const text = extractText(response);
      return text || 'No description generated.';
    } catch (error) {
      console.error('Gemini error (description):', error);
      return 'Failed to generate description with AI.';
    }
  },

  async analyzeSales(salesData: string): Promise<string> {
    try {
      const prompt = `Analyze these recent sales JSON data: ${salesData}. Give 3 quick bullet points on performance and 1 recommendation for improvement. Keep it concise.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const text = extractText(response);
      return text || 'Unable to analyze.';
    } catch (e) {
      console.error('Gemini error (analyzeSales):', e);
      return 'Analysis failed.';
    }
  },
};
