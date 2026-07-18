import { describe, it, expect } from 'vitest';
import {
  getInitials,
  getAvatarColor,
  formatDurationSeconds,
  formatMeetingDuration,
  formatCountdown,
} from './utils';

describe('utils', () => {
  describe('getInitials', () => {
    it('returns initials for a full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('returns first initial for a single name', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('returns "?" for empty or null', () => {
      expect(getInitials('')).toBe('?');
      expect(getInitials(null)).toBe('?');
      expect(getInitials(undefined)).toBe('?');
    });
  });

  describe('getAvatarColor', () => {
    it('returns a hex color string', () => {
      const color = getAvatarColor('test-id');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('returns consistent color for same ID', () => {
      expect(getAvatarColor('id1')).toBe(getAvatarColor('id1'));
    });
  });

  describe('formatDurationSeconds', () => {
    it('formats seconds into minutes or hours', () => {
      expect(formatDurationSeconds(0)).toBe('0 min');
      expect(formatDurationSeconds(59)).toBe('1 min');
      expect(formatDurationSeconds(61)).toBe('1 min');
      expect(formatDurationSeconds(3600)).toBe('1h');
      expect(formatDurationSeconds(3660)).toBe('1h 1m');
    });
  });

  describe('formatMeetingDuration', () => {
    it('formats meeting duration correctly', () => {
      const start = '2025-01-01T10:00:00Z';
      const end30m = '2025-01-01T10:30:00Z';
      const end90m = '2025-01-01T11:30:00Z';
      expect(formatMeetingDuration(start, undefined, 45)).toBe('45 min');
      expect(formatMeetingDuration(start, end30m)).toBe('30 min');
      expect(formatMeetingDuration(start, end90m)).toBe('1h 30m');
    });
  });

  describe('formatCountdown', () => {
    it('formats countdown timer', () => {
      expect(formatCountdown(5000)).toBe('00:00:05');
      expect(formatCountdown(65000)).toBe('00:01:05');
      expect(formatCountdown(3605000)).toBe('01:00:05');
      expect(formatCountdown(90000000)).toBe('1d 01h 00m');
    });
  });
});
