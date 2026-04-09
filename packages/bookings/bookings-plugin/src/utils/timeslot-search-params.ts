import qs from "qs";

type SearchParamValue = string | string[] | undefined;

type TimeslotSearchParams = {
  where?: unknown;
  [key: string]: SearchParamValue | unknown;
};

type WhereCondition = {
  startTime?: {
    greater_than_equal?: unknown;
    less_than_equal?: unknown;
  };
};

function normalizeDateFilterValue(value: string): string {
  return value.replace(/ (?=\d{2}:\d{2}$)/, "+");
}

function getFlatStartTimeFilter(searchParams: TimeslotSearchParams): string | undefined {
  const direct =
    searchParams["where[and][0][startTime][greater_than_equal]"] ||
    searchParams["where[or][0][and][0][startTime][greater_than_equal]"];

  if (typeof direct === "string") return normalizeDateFilterValue(direct);
  if (Array.isArray(direct) && typeof direct[0] === "string") {
    return normalizeDateFilterValue(direct[0]);
  }

  return undefined;
}

function normalizeCondition(condition?: WhereCondition) {
  if (!condition?.startTime) return;

  if (typeof condition.startTime.greater_than_equal === "string") {
    condition.startTime.greater_than_equal = normalizeDateFilterValue(
      condition.startTime.greater_than_equal,
    );
  }

  if (typeof condition.startTime.less_than_equal === "string") {
    condition.startTime.less_than_equal = normalizeDateFilterValue(
      condition.startTime.less_than_equal,
    );
  }
}

function getNestedStartTimeFilter(where: unknown): string | undefined {
  if (!where || typeof where !== "object") return undefined;

  const nestedWhere = where as {
    and?: WhereCondition[];
    or?: Array<{ and?: WhereCondition[] }>;
  };

  const direct = nestedWhere.and?.[0]?.startTime?.greater_than_equal;
  if (typeof direct === "string") return normalizeDateFilterValue(direct);

  const legacy = nestedWhere.or?.[0]?.and?.[0]?.startTime?.greater_than_equal;
  if (typeof legacy === "string") return normalizeDateFilterValue(legacy);

  return undefined;
}

export function getTimeslotStartTimeFilter(
  searchParams: TimeslotSearchParams | string | undefined,
): string | undefined {
  if (!searchParams) return undefined;

  if (typeof searchParams === "string") {
    return getTimeslotStartTimeFilter(
      qs.parse(searchParams, {
        ignoreQueryPrefix: true,
        depth: 6,
      }) as TimeslotSearchParams,
    );
  }

  return getFlatStartTimeFilter(searchParams) || getNestedStartTimeFilter(searchParams.where);
}

export function normalizeTimeslotSearchParams(
  searchParams: TimeslotSearchParams | string,
): Record<string, unknown> {
  const queryString =
    typeof searchParams === "string"
      ? searchParams
      : qs.stringify(searchParams, {
          addQueryPrefix: false,
          encode: false,
        });

  const parsed = qs.parse(queryString, {
    ignoreQueryPrefix: true,
    depth: 6,
  }) as Record<string, unknown>;

  const where = parsed.where as
    | {
        and?: WhereCondition[];
        or?: Array<{ and?: WhereCondition[] }>;
      }
    | undefined;

  where?.and?.forEach(normalizeCondition);
  where?.or?.forEach((group) => group.and?.forEach(normalizeCondition));

  return parsed;
}
