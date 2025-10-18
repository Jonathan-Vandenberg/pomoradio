export interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  state: string;
  language: string;
  languagecodes: string;
  votes: number;
  lastchangetime: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  lastchecktime: string;
  lastcheckoktime: string;
  lastlocalchecktime: string;
  clicktimestamp: string;
  clickcount: number;
  clicktrend: number;
  ssl_error: number;
  geo_lat: number;
  geo_long: number;
}

export interface RadioServer {
  name: string;
  url: string;
}

export interface SearchParams {
  name?: string;
  country?: string;
  countrycode?: string;
  language?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  order?: 'name' | 'url' | 'homepage' | 'favicon' | 'tags' | 'country' | 'state' | 'language' | 'votes' | 'codec' | 'bitrate' | 'lastcheckok' | 'lastchecktime' | 'lastcheckoktime' | 'lastlocalchecktime' | 'clicktimestamp' | 'clickcount' | 'clicktrend' | 'random';
  reverse?: boolean;
}

export interface ClickResponse {
  ok: string;
  message: string;
  stationuuid: string;
  name: string;
  url: string;
}
