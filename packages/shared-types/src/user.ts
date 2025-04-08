export interface User {
  id: number;
  name?: string;
  email: string;
  roles?: string[];
  stripeCustomerId?: string;
  image?: {
    url: string;
  };
  createdAt?: string;
  updatedAt?: string;
}
