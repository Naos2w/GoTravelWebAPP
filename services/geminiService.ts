import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { FlightSegment } from "../types";

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

export const createChatSession = (systemInstruction: string): Chat => {
  const ai = getAiClient();
  return ai.chats.create({
    model: "gemini-3-pro-preview",
    config: {
      systemInstruction,
    },
  });
};

export const fetchFlightDetails = async (
  flightNumber: string,
  date: string
): Promise<Partial<FlightSegment> | null> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find flight schedule for ${flightNumber} on ${date}. 
      Need Airline Name, Departure IATA, Dep Time (ISO), Arrival IATA, Arr Time (ISO).
      AIRLINE: <value>
      DEP_CODE: <value>
      DEP_TIME: <value>
      ARR_CODE: <value>
      ARR_TIME: <value>`,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response.text || "";
    const getValue = (key: string) => {
      const match = text.match(new RegExp(`${key}:\\s*(.*)`));
      return match ? match[1].trim() : "";
    };

    const airline = getValue("AIRLINE");
    if (!airline) return null;

    return {
      airline,
      flightNumber,
      departureAirport: getValue("DEP_CODE"),
      departureTime: getValue("DEP_TIME"),
      arrivalAirport: getValue("ARR_CODE"),
      arrivalTime: getValue("ARR_TIME"),
    };
  } catch (error) {
    console.error("Flight fetch failed:", error);
    return null;
  }
};
