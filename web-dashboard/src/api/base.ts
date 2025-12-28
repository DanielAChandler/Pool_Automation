/**
 * Base ESPHome API Client
 * Provides core HTTP request functionality
 */

export interface ESPHomeConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  useProxy?: boolean;
}

export class BaseESPHomeClient {
  protected baseUrl: string;
  protected auth?: string;
  protected useProxy: boolean;

  constructor(config: ESPHomeConfig) {
    this.useProxy = config.useProxy ?? false;
    const port = config.port || 80;
    
    if (this.useProxy) {
      this.baseUrl = '/api/proxy';
      this.configureProxy(config.host, port, config.username, config.password);
    } else {
      this.baseUrl = `http://${config.host}:${port}`;
    }
    
    if (config.username && config.password) {
      const credentials = btoa(`${config.username}:${config.password}`);
      this.auth = `Basic ${credentials}`;
    }
  }

  private async configureProxy(host: string, port: number, username?: string, password?: string) {
    const auth = username && password ? `Basic ${btoa(`${username}:${password}`)}` : undefined;
    
    try {
      await fetch('/api/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, auth }),
      });
    } catch (error) {
      console.error('Failed to configure proxy:', error);
    }
  }

  /**
   * Make HTTP request to ESPHome device
   */
  protected async request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.auth) {
      headers['Authorization'] = this.auth;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        return {} as T;
      }
      
      return JSON.parse(text) as T;
    } catch (error) {
      console.error(`Error making request to ${endpoint}:`, error);
      throw error;
    }
  }
}
