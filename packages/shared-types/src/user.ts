export interface User {
  id: number;
  name: string;
  email: string;
  roles?: string[];
  stripeCustomerId?: string;
  image?: {
    url: string;
  };
  parent?: User;
  createdAt?: string;
  updatedAt?: string;
}
