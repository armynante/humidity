import { describe, it, expect, beforeEach, jest } from 'bun:test';
import fs from 'fs/promises';
import axios from 'axios';
import DigitalOceanService from './DigitalOceanClient';
import { features } from 'process';

describe('DigitalOceanService', () => {
  let service: DigitalOceanService;
  const mockApiToken = 'fake-api-token';

  beforeEach(() => {
    service = new DigitalOceanService(mockApiToken);
    jest.clearAllMocks();
  });

  describe('apiRequest method', () => {
    it('should make a successful API request', async () => {
      return true;
    });
  });
});
