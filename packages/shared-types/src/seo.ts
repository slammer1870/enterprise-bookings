import { Media } from "./posts";

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  meta?: {
    title?: string | null;
    description?: string | null;
    /**
     * Maximum upload file size: 12MB. Recommended file size for images is <500KB.
     */
    image?: (number | null) | Media;
  };
  updatedAt: string;
  createdAt: string;
}
