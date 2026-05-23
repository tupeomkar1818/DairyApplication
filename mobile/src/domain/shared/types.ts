export type IsoDateString = string;

export interface EntityBase {
  id: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

