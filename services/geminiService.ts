
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

export const fetchFlightDetails = async (flightNumber: string, date: string): Promise<Partial<FlightSegment> | null> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find the flight schedule for ${flightNumber} on ${date}. 
      I need the Airline Name, Departure Airport IATA Code, Departure Time (Local time in ISO 8601 format format YYYY-MM-DDTHH:mm), Arrival Airport IATA Code, and Arrival Time (Local time in ISO 8601 format YYYY-MM-DDTHH:mm).
      
      Output the result in this specific format:
      AIRLINE: <value>
      DEP_CODE: <value>
      DEP_TIME: <value>
      ARR_CODE: <value>
      ARR_TIME: <value>
      
      If details are missing, leave the value empty.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || '';
    const getValue = (key: string) => {
      const match = text.match(new RegExp(`${key}:\\s*(.*)`));
      return match ? match[1].trim() : '';
    };

    const airline = getValue('AIRLINE');
    const depCode = getValue('DEP_CODE');
    const depTime = getValue('DEP_TIME');
    const arrCode = getValue('ARR_CODE');
    const arrTime = getValue('ARR_TIME');

    if (!airline && !depCode) return null;

    return {
      airline,
      flightNumber,
      departureAirport: depCode,
      departureTime: depTime,
      arrivalAirport: arrCode,
      arrivalTime: arrTime
    };

  } catch (error) {
    console.error("Flight fetch failed:", error);
    return null;
  }
};

export const searchFlightOptions = async (from: string, to: string, date: string): Promise<FlightSegment[]> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find real flights from ${from} to ${to} on ${date}.
      Output each flight in this format per line:
      FLIGHT_NO|AIRLINE|DEP_TIME_ISO|ARR_TIME_ISO|DEP_CODE|ARR_CODE`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || '';
    const lines = text.split('\n');
    const flights: FlightSegment[] = [];

    for (const line of lines) {
      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length === 6) {
          flights.push({
            flightNumber: parts[0],
            airline: parts[1],
            departureTime: parts[2],
            arrivalTime: parts[3],
            departureAirport: parts[4],
            arrivalAirport: parts[5]
          });
        }
      }
    }
    return flights;
  } catch (error) {
    console.error("Search flights failed:", error);
    return [];
  }
};
