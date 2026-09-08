export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      asset_assignments: {
        Row: {
          actual_return_date: string | null;
          asset_id: string;
          assigned_by: string | null;
          assignment_date: string;
          condition_at_checkin: string | null;
          condition_at_checkout: string;
          created_at: string;
          expected_return_date: string | null;
          id: string;
          notes: string;
          officer_badge: string;
          officer_id: string | null;
          officer_name: string;
          purpose: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          actual_return_date?: string | null;
          asset_id: string;
          assigned_by?: string | null;
          assignment_date?: string;
          condition_at_checkin?: string | null;
          condition_at_checkout?: string;
          created_at?: string;
          expected_return_date?: string | null;
          id?: string;
          notes?: string;
          officer_badge?: string;
          officer_id?: string | null;
          officer_name: string;
          purpose?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          actual_return_date?: string | null;
          asset_id?: string;
          assigned_by?: string | null;
          assignment_date?: string;
          condition_at_checkin?: string | null;
          condition_at_checkout?: string;
          created_at?: string;
          expected_return_date?: string | null;
          id?: string;
          notes?: string;
          officer_badge?: string;
          officer_id?: string | null;
          officer_name?: string;
          purpose?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "police_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_assignments_officer_id_fkey";
            columns: ["officer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_categories: {
        Row: {
          code: string;
          created_at: string;
          description: string;
          id: string;
          is_evidence_category: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_evidence_category?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_evidence_category?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      asset_documents: {
        Row: {
          asset_id: string;
          created_at: string;
          document_id: string;
          id: string;
          notes: string;
          relationship_type: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          document_id: string;
          id?: string;
          notes?: string;
          relationship_type: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          document_id?: string;
          id?: string;
          notes?: string;
          relationship_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_documents_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "police_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_documents_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "case_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_maintenance: {
        Row: {
          actions_taken: string;
          asset_id: string;
          completed_date: string | null;
          cost: number;
          created_at: string;
          findings: string;
          id: string;
          maintenance_type: string;
          next_scheduled_service: string | null;
          scheduled_date: string;
          service_provider: string;
          status: string;
          technician_name: string;
          updated_at: string;
        };
        Insert: {
          actions_taken?: string;
          asset_id: string;
          completed_date?: string | null;
          cost?: number;
          created_at?: string;
          findings?: string;
          id?: string;
          maintenance_type: string;
          next_scheduled_service?: string | null;
          scheduled_date?: string;
          service_provider?: string;
          status?: string;
          technician_name?: string;
          updated_at?: string;
        };
        Update: {
          actions_taken?: string;
          asset_id?: string;
          completed_date?: string | null;
          cost?: number;
          created_at?: string;
          findings?: string;
          id?: string;
          maintenance_type?: string;
          next_scheduled_service?: string | null;
          scheduled_date?: string;
          service_provider?: string;
          status?: string;
          technician_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "police_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_transfers: {
        Row: {
          asset_id: string;
          created_at: string;
          dispatched_at: string;
          from_custodian_id: string | null;
          from_custodian_name: string;
          from_location: string;
          id: string;
          reason: string;
          received_at: string | null;
          signature_verification: string | null;
          status: string;
          to_custodian_id: string | null;
          to_custodian_name: string;
          to_location: string;
          transfer_number: string;
          transit_seal_number: string | null;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          dispatched_at?: string;
          from_custodian_id?: string | null;
          from_custodian_name: string;
          from_location: string;
          id?: string;
          reason?: string;
          received_at?: string | null;
          signature_verification?: string | null;
          status?: string;
          to_custodian_id?: string | null;
          to_custodian_name: string;
          to_location: string;
          transfer_number: string;
          transit_seal_number?: string | null;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          dispatched_at?: string;
          from_custodian_id?: string | null;
          from_custodian_name?: string;
          from_location?: string;
          id?: string;
          reason?: string;
          received_at?: string | null;
          signature_verification?: string | null;
          status?: string;
          to_custodian_id?: string | null;
          to_custodian_name?: string;
          to_location?: string;
          transfer_number?: string;
          transit_seal_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "asset_transfers_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "police_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_transfers_from_custodian_id_fkey";
            columns: ["from_custodian_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_transfers_to_custodian_id_fkey";
            columns: ["to_custodian_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      case_documents: {
        Row: {
          case_id: string | null;
          category: string;
          created_at: string;
          created_by: string | null;
          current_version: number;
          document_number: string;
          file_format: string;
          file_name: string;
          file_size_bytes: number;
          fir_number: string | null;
          id: string;
          is_sealed: boolean;
          is_tampered: boolean;
          latest_sha256: string;
          metadata: Json;
          originating_agency: string;
          police_station: string;
          sensitivity_tier: Database["public"]["Enums"]["document_sensitivity_tier"];
          storage_path: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          case_id?: string | null;
          category: string;
          created_at?: string;
          created_by?: string | null;
          current_version?: number;
          document_number: string;
          file_format?: string;
          file_name: string;
          file_size_bytes?: number;
          fir_number?: string | null;
          id?: string;
          is_sealed?: boolean;
          is_tampered?: boolean;
          latest_sha256: string;
          metadata?: Json;
          originating_agency?: string;
          police_station?: string;
          sensitivity_tier?: Database["public"]["Enums"]["document_sensitivity_tier"];
          storage_path?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          current_version?: number;
          document_number?: string;
          file_format?: string;
          file_name?: string;
          file_size_bytes?: number;
          fir_number?: string | null;
          id?: string;
          is_sealed?: boolean;
          is_tampered?: boolean;
          latest_sha256?: string;
          metadata?: Json;
          originating_agency?: string;
          police_station?: string;
          sensitivity_tier?: Database["public"]["Enums"]["document_sensitivity_tier"];
          storage_path?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      document_integrity_metadata: {
        Row: {
          blockchain_block_hash: string | null;
          blockchain_block_number: number | null;
          bsa_compliance_clause: string;
          certificate_ref: string | null;
          created_at: string;
          digital_signature: string | null;
          document_id: string;
          id: string;
          last_verified_at: string;
          merkle_root: string | null;
          sha256_hash: string;
          signer_identity: string | null;
          validator_node: string | null;
          verification_status: string;
          version_id: string | null;
        };
        Insert: {
          blockchain_block_hash?: string | null;
          blockchain_block_number?: number | null;
          bsa_compliance_clause?: string;
          certificate_ref?: string | null;
          created_at?: string;
          digital_signature?: string | null;
          document_id: string;
          id?: string;
          last_verified_at?: string;
          merkle_root?: string | null;
          sha256_hash: string;
          signer_identity?: string | null;
          validator_node?: string | null;
          verification_status?: string;
          version_id?: string | null;
        };
        Update: {
          blockchain_block_hash?: string | null;
          blockchain_block_number?: number | null;
          bsa_compliance_clause?: string;
          certificate_ref?: string | null;
          created_at?: string;
          digital_signature?: string | null;
          document_id?: string;
          id?: string;
          last_verified_at?: string;
          merkle_root?: string | null;
          sha256_hash?: string;
          signer_identity?: string | null;
          validator_node?: string | null;
          verification_status?: string;
          version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_integrity_metadata_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "case_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_integrity_metadata_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      document_versions: {
        Row: {
          change_summary: string;
          created_at: string;
          document_id: string;
          file_name: string;
          file_size_bytes: number;
          id: string;
          sha256_hash: string;
          storage_path: string;
          uploaded_by: string | null;
          version_number: number;
        };
        Insert: {
          change_summary?: string;
          created_at?: string;
          document_id: string;
          file_name: string;
          file_size_bytes?: number;
          id?: string;
          sha256_hash: string;
          storage_path?: string;
          uploaded_by?: string | null;
          version_number: number;
        };
        Update: {
          change_summary?: string;
          created_at?: string;
          document_id?: string;
          file_name?: string;
          file_size_bytes?: number;
          id?: string;
          sha256_hash?: string;
          storage_path?: string;
          uploaded_by?: string | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "case_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_versions_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence_chain_of_custody: {
        Row: {
          action: string;
          asset_id: string | null;
          case_id: string | null;
          created_at: string;
          digital_signature: string;
          document_id: string | null;
          from_custodian: string;
          id: string;
          notes: string;
          purpose_reason: string;
          recorded_by: string | null;
          tamper_seal_intact: boolean;
          tamper_seal_number: string;
          to_custodian: string;
          transfer_timestamp: string;
          verification_hash: string;
        };
        Insert: {
          action: string;
          asset_id?: string | null;
          case_id?: string | null;
          created_at?: string;
          digital_signature?: string;
          document_id?: string | null;
          from_custodian: string;
          id?: string;
          notes?: string;
          purpose_reason?: string;
          recorded_by?: string | null;
          tamper_seal_intact?: boolean;
          tamper_seal_number?: string;
          to_custodian: string;
          transfer_timestamp?: string;
          verification_hash?: string;
        };
        Update: {
          action?: string;
          asset_id?: string | null;
          case_id?: string | null;
          created_at?: string;
          digital_signature?: string;
          document_id?: string | null;
          from_custodian?: string;
          id?: string;
          notes?: string;
          purpose_reason?: string;
          recorded_by?: string | null;
          tamper_seal_intact?: boolean;
          tamper_seal_number?: string;
          to_custodian?: string;
          transfer_timestamp?: string;
          verification_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_chain_of_custody_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "police_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_chain_of_custody_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_chain_of_custody_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "case_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_chain_of_custody_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      police_assets: {
        Row: {
          asset_code: string;
          assigned_officer_id: string | null;
          assigned_officer_name: string;
          barcode_rfid: string | null;
          case_id: string | null;
          category_id: string;
          condition: Database["public"]["Enums"]["asset_condition"];
          created_at: string;
          current_custodian_id: string | null;
          current_custodian_name: string;
          current_location: string;
          department_station: string;
          evidence_status: Database["public"]["Enums"]["evidence_lifecycle_status"] | null;
          fir_number: string | null;
          id: string;
          metadata: Json;
          name: string;
          purchase_cost: number | null;
          purchase_date: string | null;
          serial_number: string | null;
          status: Database["public"]["Enums"]["asset_lifecycle_status"];
          tamper_seal_number: string | null;
          updated_at: string;
          vendor_supplier: string | null;
          warranty_expiry: string | null;
        };
        Insert: {
          asset_code: string;
          assigned_officer_id?: string | null;
          assigned_officer_name?: string;
          barcode_rfid?: string | null;
          case_id?: string | null;
          category_id: string;
          condition?: Database["public"]["Enums"]["asset_condition"];
          created_at?: string;
          current_custodian_id?: string | null;
          current_custodian_name?: string;
          current_location?: string;
          department_station?: string;
          evidence_status?: Database["public"]["Enums"]["evidence_lifecycle_status"] | null;
          fir_number?: string | null;
          id?: string;
          metadata?: Json;
          name: string;
          purchase_cost?: number | null;
          purchase_date?: string | null;
          serial_number?: string | null;
          status?: Database["public"]["Enums"]["asset_lifecycle_status"];
          tamper_seal_number?: string | null;
          updated_at?: string;
          vendor_supplier?: string | null;
          warranty_expiry?: string | null;
        };
        Update: {
          asset_code?: string;
          assigned_officer_id?: string | null;
          assigned_officer_name?: string;
          barcode_rfid?: string | null;
          case_id?: string | null;
          category_id?: string;
          condition?: Database["public"]["Enums"]["asset_condition"];
          created_at?: string;
          current_custodian_id?: string | null;
          current_custodian_name?: string;
          current_location?: string;
          department_station?: string;
          evidence_status?: Database["public"]["Enums"]["evidence_lifecycle_status"] | null;
          fir_number?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          purchase_cost?: number | null;
          purchase_date?: string | null;
          serial_number?: string | null;
          status?: Database["public"]["Enums"]["asset_lifecycle_status"];
          tamper_seal_number?: string | null;
          updated_at?: string;
          vendor_supplier?: string | null;
          warranty_expiry?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "police_assets_assigned_officer_id_fkey";
            columns: ["assigned_officer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "police_assets_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "police_assets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "asset_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "police_assets_current_custodian_id_fkey";
            columns: ["current_custodian_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      adjournments: {
        Row: {
          case_id: string;
          created_at: string;
          id: string;
          previous_slot_id: string | null;
          reason: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          id?: string;
          previous_slot_id?: string | null;
          reason?: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          id?: string;
          previous_slot_id?: string | null;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "adjournments_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adjournments_previous_slot_id_fkey";
            columns: ["previous_slot_id"];
            isOneToOne: false;
            referencedRelation: "hearing_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_recommendations: {
        Row: {
          created_at: string;
          id: string;
          reasoning: string;
          schedule_id: string;
          status: Database["public"]["Enums"]["recommendation_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reasoning?: string;
          schedule_id: string;
          status?: Database["public"]["Enums"]["recommendation_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reasoning?: string;
          schedule_id?: string;
          status?: Database["public"]["Enums"]["recommendation_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: true;
            referencedRelation: "schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          entity_affected: string;
          id: string;
          timestamp: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          entity_affected?: string;
          id?: string;
          timestamp?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          entity_affected?: string;
          id?: string;
          timestamp?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      availability: {
        Row: {
          created_at: string;
          date: string;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["entity_type"];
          id: string;
          slot_id: string;
          status: Database["public"]["Enums"]["availability_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["entity_type"];
          id?: string;
          slot_id: string;
          status?: Database["public"]["Enums"]["availability_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          entity_id?: string;
          entity_type?: Database["public"]["Enums"]["entity_type"];
          id?: string;
          slot_id?: string;
          status?: Database["public"]["Enums"]["availability_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "hearing_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      case_categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          typical_duration_minutes: number;
          updated_at: string;
          urgency_weight: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          typical_duration_minutes?: number;
          updated_at?: string;
          urgency_weight?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          typical_duration_minutes?: number;
          updated_at?: string;
          urgency_weight?: number;
        };
        Relationships: [];
      };
      case_status_translations: {
        Row: {
          case_number: string;
          created_at: string;
          id: string;
          language: string;
          source_hash: string;
          summary: string;
          updated_at: string;
        };
        Insert: {
          case_number: string;
          created_at?: string;
          id?: string;
          language: string;
          source_hash: string;
          summary: string;
          updated_at?: string;
        };
        Update: {
          case_number?: string;
          created_at?: string;
          id?: string;
          language?: string;
          source_hash?: string;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cases: {
        Row: {
          case_number: string;
          category_id: string | null;
          created_at: string;
          estimated_duration_minutes: number;
          example_label: string | null;
          example_note: string | null;
          example_order: number | null;
          filing_date: string;
          id: string;
          is_example: boolean;
          is_ftsc_pocso: boolean;
          legal_priority_flag: boolean;
          parties: string;
          pending_duration_days: number;
          previous_adjournments: number;
          priority_score: number | null;
          priority_tier: string | null;
          property_dispute_5yr_plus: boolean;
          senior_citizen_litigant: boolean;
          status: Database["public"]["Enums"]["case_status"];
          statutory_limitation_deadline: string | null;
          updated_at: string;
        };
        Insert: {
          case_number: string;
          category_id?: string | null;
          created_at?: string;
          estimated_duration_minutes?: number;
          example_label?: string | null;
          example_note?: string | null;
          example_order?: number | null;
          filing_date?: string;
          id?: string;
          is_example?: boolean;
          is_ftsc_pocso?: boolean;
          legal_priority_flag?: boolean;
          parties?: string;
          pending_duration_days?: number;
          previous_adjournments?: number;
          priority_score?: number | null;
          priority_tier?: string | null;
          property_dispute_5yr_plus?: boolean;
          senior_citizen_litigant?: boolean;
          status?: Database["public"]["Enums"]["case_status"];
          statutory_limitation_deadline?: string | null;
          updated_at?: string;
        };
        Update: {
          case_number?: string;
          category_id?: string | null;
          created_at?: string;
          estimated_duration_minutes?: number;
          example_label?: string | null;
          example_note?: string | null;
          example_order?: number | null;
          filing_date?: string;
          id?: string;
          is_example?: boolean;
          is_ftsc_pocso?: boolean;
          legal_priority_flag?: boolean;
          parties?: string;
          pending_duration_days?: number;
          previous_adjournments?: number;
          priority_score?: number | null;
          priority_tier?: string | null;
          property_dispute_5yr_plus?: boolean;
          senior_citizen_litigant?: boolean;
          status?: Database["public"]["Enums"]["case_status"];
          statutory_limitation_deadline?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cases_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "case_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      courtrooms: {
        Row: {
          capacity: number;
          created_at: string;
          current_allocation: number;
          id: string;
          name: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          capacity?: number;
          created_at?: string;
          current_allocation?: number;
          id?: string;
          name: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          current_allocation?: number;
          id?: string;
          name?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hearing_slots: {
        Row: {
          created_at: string;
          date: string;
          end_time: string;
          id: string;
          start_time: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          end_time: string;
          id?: string;
          start_time: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          end_time?: string;
          id?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      judges: {
        Row: {
          created_at: string;
          current_workload: number;
          id: string;
          name: string;
          specialisation: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          current_workload?: number;
          id?: string;
          name: string;
          specialisation?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          current_workload?: number;
          id?: string;
          name?: string;
          specialisation?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      notifications_log: {
        Row: {
          case_id: string;
          channel: string;
          content: string;
          created_at: string;
          id: string;
          recipient: string;
          sent_at: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          channel: string;
          content?: string;
          created_at?: string;
          id?: string;
          recipient?: string;
          sent_at?: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          channel?: string;
          content?: string;
          created_at?: string;
          id?: string;
          recipient?: string;
          sent_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_log_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      priority_settings: {
        Row: {
          adjournment_cap: number;
          adjournment_weight: number;
          boost_points: number;
          category_weight: number;
          created_at: string;
          ftsc_pocso_weight: number;
          id: string;
          limitation_deadline_weight: number;
          limitation_horizon_days: number;
          max_judge_workload: number;
          pending_cap_days: number;
          pending_weight: number;
          property_dispute_weight: number;
          sched_priority_weight: number;
          sched_specialisation_weight: number;
          sched_utilisation_weight: number;
          sched_workload_weight: number;
          senior_citizen_weight: number;
          singleton: boolean;
          updated_at: string;
        };
        Insert: {
          adjournment_cap?: number;
          adjournment_weight?: number;
          boost_points?: number;
          category_weight?: number;
          created_at?: string;
          ftsc_pocso_weight?: number;
          id?: string;
          limitation_deadline_weight?: number;
          limitation_horizon_days?: number;
          max_judge_workload?: number;
          pending_cap_days?: number;
          pending_weight?: number;
          property_dispute_weight?: number;
          sched_priority_weight?: number;
          sched_specialisation_weight?: number;
          sched_utilisation_weight?: number;
          sched_workload_weight?: number;
          senior_citizen_weight?: number;
          singleton?: boolean;
          updated_at?: string;
        };
        Update: {
          adjournment_cap?: number;
          adjournment_weight?: number;
          boost_points?: number;
          category_weight?: number;
          created_at?: string;
          ftsc_pocso_weight?: number;
          id?: string;
          limitation_deadline_weight?: number;
          limitation_horizon_days?: number;
          max_judge_workload?: number;
          pending_cap_days?: number;
          pending_weight?: number;
          property_dispute_weight?: number;
          sched_priority_weight?: number;
          sched_specialisation_weight?: number;
          sched_utilisation_weight?: number;
          sched_workload_weight?: number;
          senior_citizen_weight?: number;
          singleton?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          permissions: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
          permissions?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          permissions?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedules: {
        Row: {
          case_id: string;
          cause_list_position: number | null;
          courtroom_id: string | null;
          created_at: string;
          id: string;
          judge_id: string | null;
          slot_id: string | null;
          status: Database["public"]["Enums"]["schedule_status"];
          updated_at: string;
        };
        Insert: {
          case_id: string;
          cause_list_position?: number | null;
          courtroom_id?: string | null;
          created_at?: string;
          id?: string;
          judge_id?: string | null;
          slot_id?: string | null;
          status?: Database["public"]["Enums"]["schedule_status"];
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          cause_list_position?: number | null;
          courtroom_id?: string | null;
          created_at?: string;
          id?: string;
          judge_id?: string | null;
          slot_id?: string | null;
          status?: Database["public"]["Enums"]["schedule_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedules_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_courtroom_id_fkey";
            columns: ["courtroom_id"];
            isOneToOne: false;
            referencedRelation: "courtrooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_judge_id_fkey";
            columns: ["judge_id"];
            isOneToOne: false;
            referencedRelation: "judges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "hearing_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_judge_id: { Args: never; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_bench_user: { Args: never; Returns: boolean };
      is_registry_staff: { Args: never; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "registrar" | "judge";
      asset_condition: "NEW" | "EXCELLENT" | "GOOD" | "FAIR" | "DAMAGED" | "NEEDS_REPAIR" | "DECOMMISSIONED";
      asset_lifecycle_status: "REGISTERED" | "AVAILABLE" | "ASSIGNED" | "IN_USE" | "TRANSFERRED" | "MAINTENANCE" | "RETURNED" | "RETIRED" | "LOST";
      availability_status: "available" | "unavailable";
      case_status: "filed" | "scheduled" | "in_progress" | "adjourned" | "disposed";
      document_sensitivity_tier: "PUBLIC" | "RESTRICTED" | "SEALED_COVER_IN_CAMERA";
      entity_type: "judge" | "courtroom";
      evidence_lifecycle_status: "SEIZED" | "REGISTERED" | "SEALED" | "STORED" | "TRANSFERRED" | "FORENSIC_EXAMINATION" | "RETURNED" | "COURT_SUBMISSION" | "DISPOSED";
      recommendation_status: "accepted" | "modified" | "rejected";
      schedule_status: "proposed" | "confirmed" | "completed" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "registrar", "judge"],
      availability_status: ["available", "unavailable"],
      case_status: ["filed", "scheduled", "in_progress", "adjourned", "disposed"],
      entity_type: ["judge", "courtroom"],
      recommendation_status: ["accepted", "modified", "rejected"],
      schedule_status: ["proposed", "confirmed", "completed", "cancelled"],
    },
  },
} as const;
