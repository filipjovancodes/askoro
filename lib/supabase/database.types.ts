export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      data_sources: {
        Row: {
          id: string;
          user_id: string;
          data_source_type: string;
          last_sync_time: string | null;
          auth: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data_source_type: string;
          last_sync_time?: string | null;
          auth: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data_source_type?: string;
          last_sync_time?: string | null;
          auth?: Json;
          created_at?: string;
        };
      };
    };
  };
}
