
export type OpportunityPayload = {
  id: string;
  name: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  percentChange: number;
  updatedAt: string; // ISO timestamp
};

export type OpportunityMessage =
  | {
      type: "new_opportunity";
      payload: OpportunityPayload;
    }
  | {
      type: "opportunity_update";
      payload: OpportunityPayload;
    }
  | {
      type: "remove_opportunity";
      payload: { id: string };
    }
  | {
      type: "heartbeat";
      timestamp: string;
    }
  | {
      type: "error";
      message: string;
    };
