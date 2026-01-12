
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { FlightSegment } from "../types";

// Standardize Gemini initialization to use process.env.API_KEY exclusively
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const createChatSession = (systemInstruction: string): Chat => {
  const ai = getAiClient();
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction,
    },
  });
};

export const generateTravelImage = async (
  prompt: string, 
  size: '1K' | '2K' | '4K'
): Promise<string | null> => {
  if (window.aistudio) {
     const hasKey = await window.aistudio.hasSelectedApiKey();
     if (!hasKey) {
        throw new Error("API_KEY_REQUIRED");
     }
  }

  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3",
          imageSize: size
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};

