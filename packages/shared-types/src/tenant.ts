export interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain?: string | null;
  description?: string | null;
  logo?: {
    id: number;
    url?: string;
  } | number | null;
  updatedAt?: string;
  createdAt?: string;
}
