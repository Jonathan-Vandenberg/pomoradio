import type { RadioStation, RadioServer, SearchParams, ClickResponse } from '@/types/radio';

class RadioAPI {
  private servers: RadioServer[] = [];
  private currentServerIndex = 0;
  private userAgent = 'PomaRadio/1.0';

  /**
   * Discover available radio-browser servers
   */
  async discoverServers(): Promise<RadioServer[]> {
    try {
      // Use DNS lookup to get available servers
      // Since we're in the browser, we'll use a fallback list of known servers
      const knownServers = [
        'de1.api.radio-browser.info',
        'fi1.api.radio-browser.info',
        'at1.api.radio-browser.info',
        'nl1.api.radio-browser.info',
        'de2.api.radio-browser.info',
      ];

      // Randomize the server list as recommended
      const shuffledServers = [...knownServers].sort(() => Math.random() - 0.5);
      
      this.servers = shuffledServers.map(server => ({
        name: server,
        url: `https://${server}`
      }));

      return this.servers;
    } catch (error) {
      console.error('Failed to discover servers:', error);
      throw new Error('Could not discover radio servers');
    }
  }

  /**
   * Get the current server URL
   */
  private getCurrentServer(): string {
    if (this.servers.length === 0) {
      throw new Error('No servers available. Call discoverServers() first.');
    }
    return this.servers[this.currentServerIndex].url;
  }

  /**
   * Rotate to the next server in case of failures
   */
  private rotateServer(): void {
    this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
  }

  /**
   * Make an API request with automatic server rotation on failure
   */
  private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const maxRetries = this.servers.length;
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const server = this.getCurrentServer();
        const url = new URL(`${server}/json${endpoint}`);
        
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              url.searchParams.set(key, value.toString());
            }
          });
        }

        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Request failed on server ${this.getCurrentServer()}:`, error);
        this.rotateServer();
      }
    }

    throw lastError || new Error('All servers failed');
  }

  /**
   * Search for radio stations
   */
  async searchStations(params: SearchParams = {}): Promise<RadioStation[]> {
    return this.makeRequest<RadioStation[]>('/stations/search', {
      ...params,
      hidebroken: 'true', // Only return working stations
    });
  }

  /**
   * Get stations by country
   */
  async getStationsByCountry(countrycode: string, limit = 20): Promise<RadioStation[]> {
    return this.searchStations({ countrycode, limit, order: 'votes', reverse: true });
  }

  /**
   * Get popular stations
   */
  async getPopularStations(limit = 20): Promise<RadioStation[]> {
    return this.searchStations({ limit, order: 'votes', reverse: true });
  }

  /**
   * Get random stations
   */
  async getRandomStations(limit = 20): Promise<RadioStation[]> {
    return this.searchStations({ limit, order: 'random' });
  }

  /**
   * Get stations by genre/tag
   */
  async getStationsByTag(tag: string, limit = 20): Promise<RadioStation[]> {
    return this.searchStations({ tag, limit, order: 'votes', reverse: true });
  }

  /**
   * Register a click for a station (helps with popularity metrics)
   */
  async registerClick(stationuuid: string): Promise<ClickResponse> {
    return this.makeRequest<ClickResponse>(`/url/${stationuuid}`);
  }

  /**
   * Get station by UUID
   */
  async getStationByUuid(stationuuid: string): Promise<RadioStation[]> {
    return this.makeRequest<RadioStation[]>(`/stations/byuuid/${stationuuid}`);
  }

  /**
   * Get all available countries
   */
  async getCountries(): Promise<Array<{ name: string; iso_3166_1: string; stationcount: number }>> {
    return this.makeRequest('/countries');
  }

  /**
   * Get all available tags
   */
  async getTags(limit = 100): Promise<Array<{ name: string; stationcount: number }>> {
    return this.makeRequest('/tags', { limit });
  }
}

// Export a singleton instance
export const radioAPI = new RadioAPI();

// Initialize servers on first import
radioAPI.discoverServers().catch(console.error);
