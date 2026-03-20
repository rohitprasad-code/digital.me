/**
 * ESP32 Smart Bulb Client
 *
 * Handles all HTTP communication with the ESP32 device.
 * Requires BULB_API_URL environment variable pointing to the ESP32 endpoint.
 */

const BULB_API_URL = process.env.BULB_API_URL || "http://192.168.1.100";

export class ESP32Client {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || BULB_API_URL;
  }

  async setBulbState(state: "on" | "off") {
    const response = await fetch(`${this.baseUrl}/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ESP32 responded with ${response.status}: ${errorText}`);
    }

    return { success: true, state, message: `Bulb turned ${state}` };
  }

  async getBulbState() {
    const response = await fetch(`${this.baseUrl}/state`);

    if (!response.ok) {
      throw new Error(`ESP32 responded with ${response.status}`);
    }

    const data = await response.json();
    return { state: data.state || "unknown" };
  }
}
