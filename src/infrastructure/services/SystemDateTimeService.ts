import type { DateTimeService, ParsedDateTime } from "../../domain/services/DateTimeService";

export class SystemDateTimeService implements DateTimeService {
  parse(input: string, _options: { timezone: string }): ParsedDateTime | null {
    const iso = Date.parse(input);
    if (Number.isNaN(iso)) {
      return null;
    }
    return {
      value: new Date(iso),
      ambiguous: false,
    };
  }
}

