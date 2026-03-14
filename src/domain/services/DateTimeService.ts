export interface ParsedDateTime {
  value: Date;
  ambiguous: boolean;
  clarificationNeeded?: boolean;
}

/**
 * Port for date and time parsing, so we can test natural language parsing
 * without binding to a specific library.
 */
export interface DateTimeService {
  parse(input: string, options: { timezone: string }): ParsedDateTime | null;
}

