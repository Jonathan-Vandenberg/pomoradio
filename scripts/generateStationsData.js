const fs = require('fs');
const path = require('path');

// Simple fetch implementation for Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class RadioAPI {
  constructor() {
    this.servers = [
      'de1.api.radio-browser.info',
      'fi1.api.radio-browser.info', 
      'at1.api.radio-browser.info',
      'nl1.api.radio-browser.info',
      'de2.api.radio-browser.info',
    ];
    this.currentServerIndex = 0;
    this.userAgent = 'PomaRadio/1.0';
  }

  getCurrentServer() {
    return `https://${this.servers[this.currentServerIndex]}`;
  }

  rotateServer() {
    this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
  }

  async makeRequest(endpoint, params = {}) {
    const maxRetries = this.servers.length;
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const server = this.getCurrentServer();
        const url = new URL(`${server}/json${endpoint}`);
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, value.toString());
          }
        });

        console.log(`Requesting: ${url.toString()}`);
        
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error;
        console.warn(`Request failed on server ${this.getCurrentServer()}:`, error.message);
        this.rotateServer();
        
        // Add delay between retries
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastError || new Error('All servers failed');
  }

  async getCountries() {
    return this.makeRequest('/countries');
  }

  async getStationsByCountry(countrycode, limit = 20) {
    return this.makeRequest('/stations/search', { 
      countrycode, 
      limit, 
      order: 'votes', 
      reverse: 'true',
      hidebroken: 'true'
    });
  }

  async getPopularStations(limit = 20) {
    return this.makeRequest('/stations/search', { 
      limit, 
      order: 'votes', 
      reverse: 'true',
      hidebroken: 'true'
    });
  }
}

function getStationColor(station) {
  if (station.bitrate >= 256) return '#00ff00'; // High quality - green
  if (station.bitrate >= 128) return '#ffff00'; // Medium quality - yellow  
  if (station.bitrate >= 64) return '#ff8800';  // Low quality - orange
  return '#ff4444'; // Very low quality - red
}

async function generateStationsData() {
  const radioAPI = new RadioAPI();
  
  try {
    console.log('🌍 Starting global radio stations data generation...\n');
    
    // Get all countries
    console.log('📡 Fetching all countries...');
    const countries = await radioAPI.getCountries();
    
    const countriesWithStations = countries
      .filter(country => country.stationcount > 0)
      .sort((a, b) => b.stationcount - a.stationcount);
    
    console.log(`Found ${countriesWithStations.length} countries with radio stations\n`);
    
    const allStations = [];
    let processed = 0;
    
    // Load stations from each country  
    for (const country of countriesWithStations) {
      try {
        // Load more stations from countries with higher station counts
        const limit = country.stationcount > 1000 ? 500 : 
                     country.stationcount > 100 ? 100 : 
                     country.stationcount > 20 ? 20 : 10;
        
        console.log(`🎵 Loading ${limit} stations from ${country.name} (${country.iso_3166_1}) - ${country.stationcount} total stations`);
        
        const countryStations = await radioAPI.getStationsByCountry(country.iso_3166_1, limit);
        
        // Filter stations with valid coordinates and add metadata
        const validStations = countryStations
          .filter(station => station.geo_lat && station.geo_long && station.lastcheckok === 1)
          .map(station => ({
            stationuuid: station.stationuuid,
            name: station.name,
            url: station.url,
            url_resolved: station.url_resolved,
            country: station.country,
            countrycode: station.countrycode,
            codec: station.codec,
            bitrate: station.bitrate,
            votes: station.votes,
            lat: station.geo_lat,
            lng: station.geo_long,
            color: getStationColor(station)
          }));
        
        allStations.push(...validStations);
        processed++;
        
        console.log(`   ✅ Added ${validStations.length} valid stations (${processed}/${countriesWithStations.length})`);
        
        // Add delay to avoid overwhelming the API
        if (processed < countriesWithStations.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.warn(`   ❌ Failed to load stations for ${country.name}:`, error.message);
      }
    }

    // Add popular stations to fill gaps
    try {
      console.log('\n🔥 Adding popular stations...');
      const popularStations = await radioAPI.getPopularStations(100);
      
      const validPopularStations = popularStations
        .filter(station => station.geo_lat && station.geo_long && station.lastcheckok === 1)
        .map(station => ({
          stationuuid: station.stationuuid,
          name: station.name,
          url: station.url,
          url_resolved: station.url_resolved,
          country: station.country,
          countrycode: station.countrycode,
          codec: station.codec,
          bitrate: station.bitrate,
          votes: station.votes,
          lat: station.geo_lat,
          lng: station.geo_long,
          color: getStationColor(station)
        }));
      
      allStations.push(...validPopularStations);
      console.log(`   ✅ Added ${validPopularStations.length} popular stations`);
    } catch (error) {
      console.warn('   ❌ Failed to load popular stations:', error.message);
    }

    // Remove duplicates based on station UUID
    const uniqueStations = allStations.filter((station, index, self) => 
      index === self.findIndex(s => s.stationuuid === station.stationuuid)
    );

    // Sort by votes (popularity) for better user experience
    uniqueStations.sort((a, b) => b.votes - a.votes);

    // Create the data object
    const radioData = {
      generated: new Date().toISOString(),
      totalStations: uniqueStations.length,
      totalCountries: [...new Set(uniqueStations.map(s => s.countrycode))].length,
      stations: uniqueStations
    };

    // Save to public directory so it can be fetched from the frontend
    const outputPath = path.join(__dirname, '../public/radio-stations.json');
    fs.writeFileSync(outputPath, JSON.stringify(radioData, null, 2));

    console.log(`\n🎉 Successfully generated radio stations data!`);
    console.log(`📊 Stats:`);
    console.log(`   • Total stations: ${radioData.totalStations}`);
    console.log(`   • Total countries: ${radioData.totalCountries}`);
    console.log(`   • File size: ${Math.round(fs.statSync(outputPath).size / 1024)} KB`);
    console.log(`   • Saved to: ${outputPath}`);
    
    // Generate summary by country
    const countryStats = {};
    uniqueStations.forEach(station => {
      if (!countryStats[station.country]) {
        countryStats[station.country] = 0;
      }
      countryStats[station.country]++;
    });
    
    const topCountries = Object.entries(countryStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    console.log(`\n🏆 Top 10 countries by stations:`);
    topCountries.forEach(([country, count], index) => {
      console.log(`   ${index + 1}. ${country}: ${count} stations`);
    });

  } catch (error) {
    console.error('❌ Error generating stations data:', error);
    process.exit(1);
  }
}

// Run the script
generateStationsData();
