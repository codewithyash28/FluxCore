import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AuditResult {
  healthScore: number;
  optimizationPotential: number;
  energySavings: number;
  securitySeverity: "Low" | "Med" | "High" | "Critical";
  regressionStatus: "Stable" | "Regression";
  securityFindings: string[];
  optimizationFindings: string[];
  findings: string;
  optimizedCode: string;
  ecoLogic: string;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 3000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorString = JSON.stringify(error).toLowerCase();
      const errorMessage = (error?.message || "").toLowerCase();
      
      const isRateLimit = errorString.includes('429') || 
                          errorString.includes('resource_exhausted') ||
                          errorString.includes('quota') ||
                          errorMessage.includes('429') ||
                          errorMessage.includes('resource_exhausted') ||
                          errorMessage.includes('quota') ||
                          error?.status === 429 || 
                          error?.code === 429 ||
                          error?.error?.code === 429 ||
                          error?.error?.status === 'RESOURCE_EXHAUSTED' ||
                          error?.response?.status === 429;

      if (isRateLimit && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Gemini API rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (isRateLimit) {
        throw new Error("AI Quota exceeded. The system is currently under high load. Please try again in a few minutes.");
      }
      
      throw error;
    }
  }
  throw lastError;
}

export async function generateCode(prompt: string): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model,
      contents: `You are FluxCore AI. The user wants to generate code for: ${prompt}. 
      Provide high-quality, secure, and eco-efficient code. 
      Return only the code block without extra explanation.`,
    }));

    return response.text || "Failed to generate code.";
  } catch (error: any) {
    console.error("AI Generation failed:", error);
    return `Error: ${error.message || "Unknown error"}`;
  }
}

export async function performAudit(code: string, repoUrl: string, history: any[]): Promise<AuditResult> {
  const model = "gemini-3.1-pro-preview";
  
  const historyContext = history.length > 0 
    ? `Previous audit history for context: ${JSON.stringify(history.slice(-3).map(h => ({ score: h.healthScore, security: h.securitySeverity })))}`
    : "No previous audit history available.";

  const prompt = `
    You are FluxCore, the autonomous CI/CD Gatekeeper.
    Audit the following code for a production-grade deployment.
    Repository: ${repoUrl}
    ${historyContext}

    CODE TO AUDIT:
    ${code}

    Perform a deep analysis on:
    1. Security (OWASP Top 10): Detect Injection, Broken Access Control, Secrets, etc.
    2. Eco-Efficiency: Analyze algorithmic Big O complexity. Calculate carbon footprint reduction based on resource cycles saved (CPU/RAM).
    3. Performance: Provide granular insights (execution time reduction in milliseconds/%).

    Provide a refactored, optimized version of the code.
    
    For Eco-Logic Rationale, use this format:
    "This refactor saves ~[X] ms and [Y]% CPU → ~[Z]% lower energy on average server. [Scientific explanation]."
    
    Return the result in JSON format.
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            healthScore: { type: Type.NUMBER, description: "Score from 0.0 to 1.0" },
            optimizationPotential: { type: Type.NUMBER, description: "Potential from 0.0 to 1.0" },
            energySavings: { type: Type.NUMBER, description: "Percentage of energy saved" },
            securitySeverity: { type: Type.STRING, enum: ["Low", "Med", "High", "Critical"] },
            regressionStatus: { type: Type.STRING, enum: ["Stable", "Regression"] },
            securityFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
            optimizationFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
            findings: { type: Type.STRING, description: "Detailed Markdown summary" },
            optimizedCode: { type: Type.STRING, description: "The refactored code block" },
            ecoLogic: { type: Type.STRING, description: "Scientific explanation of hardware efficiency gains" }
          },
          required: ["healthScore", "optimizationPotential", "energySavings", "securitySeverity", "regressionStatus", "securityFindings", "optimizationFindings", "findings", "optimizedCode", "ecoLogic"]
        }
      }
    }));

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Audit failed:", error);
    throw error;
  }
}
