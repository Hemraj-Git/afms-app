// Generated from the live Supabase schema (Supabase MCP `generate_typescript_types`,
// 20 Sep 2026, migrations up to 0034; departments.head_user_id from 0035 and asset_activity_logs.reference_id from 0037 added by hand). Do not edit by hand -- regenerate after a
// migration changes a table, e.g. `npx supabase gen types typescript --project-id <id>`.
// Convenience aliases (Row/Insert/Update by table name) live in src/lib/supabase/typed.ts.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      asset_activity_logs: {
        Row: {
          action: string
          asset_id: string | null
          by_user: string
          id: string
          reference_id: string | null
          remarks: string | null
          source: string
          timestamp: string
          timestamp_epoch: number | null
        }
        Insert: {
          action: string
          asset_id?: string | null
          by_user: string
          id: string
          reference_id?: string | null
          remarks?: string | null
          source: string
          timestamp: string
          timestamp_epoch?: number | null
        }
        Update: {
          action?: string
          asset_id?: string | null
          by_user?: string
          id?: string
          reference_id?: string | null
          remarks?: string | null
          source?: string
          timestamp?: string
          timestamp_epoch?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_activity_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          amc_end_date: string | null
          amc_start_date: string | null
          asset_id: string
          assigned_to_user_id: string | null
          assigned_to_user_name: string | null
          created_at: string
          dynamic_specifications: Json | null
          id: string
          image_url: string | null
          installation_date: string
          last_printed_at: string | null
          last_serviced_date: string | null
          maintenance_by: string | null
          maintenance_vendor_id: string | null
          manufacturer: string | null
          model_number: string | null
          name: string
          notes: string | null
          price: number | null
          purchase_date: string | null
          purchase_vendor_id: string | null
          qr_code_url: string | null
          room_id: string | null
          serial_number: string | null
          status: string | null
          sub_category_id: string | null
          warranty_till: string | null
        }
        Insert: {
          amc_end_date?: string | null
          amc_start_date?: string | null
          asset_id: string
          assigned_to_user_id?: string | null
          assigned_to_user_name?: string | null
          created_at: string
          dynamic_specifications?: Json | null
          id?: string
          image_url?: string | null
          installation_date: string
          last_printed_at?: string | null
          last_serviced_date?: string | null
          maintenance_by?: string | null
          maintenance_vendor_id?: string | null
          manufacturer?: string | null
          model_number?: string | null
          name: string
          notes?: string | null
          price?: number | null
          purchase_date?: string | null
          purchase_vendor_id?: string | null
          qr_code_url?: string | null
          room_id?: string | null
          serial_number?: string | null
          status?: string | null
          sub_category_id?: string | null
          warranty_till?: string | null
        }
        Update: {
          amc_end_date?: string | null
          amc_start_date?: string | null
          asset_id?: string
          assigned_to_user_id?: string | null
          assigned_to_user_name?: string | null
          created_at?: string
          dynamic_specifications?: Json | null
          id?: string
          image_url?: string | null
          installation_date?: string
          last_printed_at?: string | null
          last_serviced_date?: string | null
          maintenance_by?: string | null
          maintenance_vendor_id?: string | null
          manufacturer?: string | null
          model_number?: string | null
          name?: string
          notes?: string | null
          price?: number | null
          purchase_date?: string | null
          purchase_vendor_id?: string | null
          qr_code_url?: string | null
          room_id?: string | null
          serial_number?: string | null
          status?: string | null
          sub_category_id?: string | null
          warranty_till?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_maintenance_vendor_id_fkey"
            columns: ["maintenance_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_purchase_vendor_id_fkey"
            columns: ["purchase_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          campus_id: string | null
          code: string
          created_at: string
          id: string
          name: string
          total_floors: number | null
        }
        Insert: {
          campus_id?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          total_floors?: number | null
        }
        Update: {
          campus_id?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          total_floors?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          interval: string | null
          items: Json
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          interval?: string | null
          items?: Json
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          interval?: string | null
          items?: Json
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          head_user_id: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          head_user_id?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          head_user_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_user_id_fkey"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          asset_id: string | null
          category: string
          file_name: string
          file_size_bytes: number
          file_type: string
          file_url: string
          id: string
          inventory_item_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          uploaded_at: string
          uploaded_by_user_name: string
        }
        Insert: {
          asset_id?: string | null
          category: string
          file_name: string
          file_size_bytes: number
          file_type: string
          file_url: string
          id?: string
          inventory_item_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          uploaded_at: string
          uploaded_by_user_name: string
        }
        Update: {
          asset_id?: string | null
          category?: string
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          file_url?: string
          id?: string
          inventory_item_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          uploaded_at?: string
          uploaded_by_user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          asset_id: string | null
          checklist_responses: Json | null
          checklist_snapshot: Json | null
          conducted_at: string | null
          conducted_by: string | null
          conducted_by_user_id: string | null
          created_at: string
          due_date: string
          id: string
          inspection_number: string
          item_photos: Json | null
          photo_url: string | null
          remarks: string | null
          result: string | null
          status: string | null
          template_id: string | null
          template_version: number | null
        }
        Insert: {
          asset_id?: string | null
          checklist_responses?: Json | null
          checklist_snapshot?: Json | null
          conducted_at?: string | null
          conducted_by?: string | null
          conducted_by_user_id?: string | null
          created_at: string
          due_date: string
          id?: string
          inspection_number: string
          item_photos?: Json | null
          photo_url?: string | null
          remarks?: string | null
          result?: string | null
          status?: string | null
          template_id?: string | null
          template_version?: number | null
        }
        Update: {
          asset_id?: string | null
          checklist_responses?: Json | null
          checklist_snapshot?: Json | null
          conducted_at?: string | null
          conducted_by?: string | null
          conducted_by_user_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          inspection_number?: string
          item_photos?: Json | null
          photo_url?: string | null
          remarks?: string | null
          result?: string | null
          status?: string | null
          template_id?: string | null
          template_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          dynamic_specifications: Json | null
          id: string
          image_url: string | null
          inventory_number: string
          manufacturer: string | null
          min_stock_level: number | null
          model_number: string | null
          name: string
          notes: string | null
          part_number: string | null
          purchase_date: string | null
          quantity: number | null
          room_id: string | null
          serial_number: string | null
          storage_location: string | null
          sub_category_id: string | null
          unit_cost: number | null
          vendor_id: string | null
          warranty_till: string | null
        }
        Insert: {
          created_at: string
          dynamic_specifications?: Json | null
          id: string
          image_url?: string | null
          inventory_number: string
          manufacturer?: string | null
          min_stock_level?: number | null
          model_number?: string | null
          name: string
          notes?: string | null
          part_number?: string | null
          purchase_date?: string | null
          quantity?: number | null
          room_id?: string | null
          serial_number?: string | null
          storage_location?: string | null
          sub_category_id?: string | null
          unit_cost?: number | null
          vendor_id?: string | null
          warranty_till?: string | null
        }
        Update: {
          created_at?: string
          dynamic_specifications?: Json | null
          id?: string
          image_url?: string | null
          inventory_number?: string
          manufacturer?: string | null
          min_stock_level?: number | null
          model_number?: string | null
          name?: string
          notes?: string | null
          part_number?: string | null
          purchase_date?: string | null
          quantity?: number | null
          room_id?: string | null
          serial_number?: string | null
          storage_location?: string | null
          sub_category_id?: string | null
          unit_cost?: number | null
          vendor_id?: string | null
          warranty_till?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          ref_id: string | null
          ref_table: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string | null
          ref_table?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string | null
          ref_table?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          role: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          date: string
          department_name: string | null
          group_booking_id: string | null
          id: string
          purpose: string
          reservation_number: string
          room_id: string | null
          room_name: string
          slot_hour: number
          status: string | null
          time_slot: string
          user_id: string
          user_name: string
          user_role: string | null
        }
        Insert: {
          created_at: string
          date: string
          department_name?: string | null
          group_booking_id?: string | null
          id: string
          purpose: string
          reservation_number: string
          room_id?: string | null
          room_name: string
          slot_hour: number
          status?: string | null
          time_slot: string
          user_id: string
          user_name: string
          user_role?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          department_name?: string | null
          group_booking_id?: string | null
          id?: string
          purpose?: string
          reservation_number?: string
          room_id?: string | null
          room_name?: string
          slot_hour?: number
          status?: string | null
          time_slot?: string
          user_id?: string
          user_name?: string
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_access_logs: {
        Row: {
          activity_number: string | null
          auto_checkout_note: string | null
          check_in_date: string
          check_in_time: string
          check_in_timestamp: number
          check_out_time: string | null
          check_out_timestamp: number | null
          id: string
          is_force_checkout: boolean | null
          purpose: string | null
          room_id: string | null
          user_id: string
          user_name: string
          user_role: string | null
        }
        Insert: {
          activity_number?: string | null
          auto_checkout_note?: string | null
          check_in_date: string
          check_in_time: string
          check_in_timestamp: number
          check_out_time?: string | null
          check_out_timestamp?: number | null
          id: string
          is_force_checkout?: boolean | null
          purpose?: string | null
          room_id?: string | null
          user_id: string
          user_name: string
          user_role?: string | null
        }
        Update: {
          activity_number?: string | null
          auto_checkout_note?: string | null
          check_in_date?: string
          check_in_time?: string
          check_in_timestamp?: number
          check_out_time?: string | null
          check_out_timestamp?: number | null
          id?: string
          is_force_checkout?: boolean | null
          purpose?: string | null
          room_id?: string | null
          user_id?: string
          user_name?: string
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_access_logs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          building_id: string | null
          created_at: string
          current_occupant: string | null
          floor: string | null
          id: string
          is_reservable: boolean | null
          last_printed_at: string | null
          name: string
          qr_code_key: string
          room_number: string
          room_size_sqft: number | null
          status: string
          type: string
        }
        Insert: {
          building_id?: string | null
          created_at?: string
          current_occupant?: string | null
          floor?: string | null
          id?: string
          is_reservable?: boolean | null
          last_printed_at?: string | null
          name: string
          qr_code_key: string
          room_number: string
          room_size_sqft?: number | null
          status?: string
          type?: string
        }
        Update: {
          building_id?: string | null
          created_at?: string
          current_occupant?: string | null
          floor?: string | null
          id?: string
          is_reservable?: boolean | null
          last_printed_at?: string | null
          name?: string
          qr_code_key?: string
          room_number?: string
          room_size_sqft?: number | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          assigned_to_name: string | null
          created_at: string
          description: string | null
          dismissal_reason: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          photo_urls: string[] | null
          priority: string | null
          requested_by_email: string | null
          requested_by_name: string
          requested_by_phone: string | null
          requested_by_user_id: string | null
          resolution_notes: string | null
          room_id: string | null
          sla_due_date: string | null
          status: string | null
          ticket_id: string
          title: string
          type: string | null
          work_order_id: string | null
          work_order_number: string | null
          work_order_type: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          created_at: string
          description?: string | null
          dismissal_reason?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          photo_urls?: string[] | null
          priority?: string | null
          requested_by_email?: string | null
          requested_by_name: string
          requested_by_phone?: string | null
          requested_by_user_id?: string | null
          resolution_notes?: string | null
          room_id?: string | null
          sla_due_date?: string | null
          status?: string | null
          ticket_id: string
          title: string
          type?: string | null
          work_order_id?: string | null
          work_order_number?: string | null
          work_order_type?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          assigned_to_name?: string | null
          created_at?: string
          description?: string | null
          dismissal_reason?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          photo_urls?: string[] | null
          priority?: string | null
          requested_by_email?: string | null
          requested_by_name?: string
          requested_by_phone?: string | null
          requested_by_user_id?: string | null
          resolution_notes?: string | null
          room_id?: string | null
          sla_due_date?: string | null
          status?: string | null
          ticket_id?: string
          title?: string
          type?: string | null
          work_order_id?: string | null
          work_order_number?: string | null
          work_order_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_categories: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          inspection_template_ids: string[] | null
          metadata_fields: Json | null
          name: string
          pm_template_ids: string[] | null
          sla_priority: string | null
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          inspection_template_ids?: string[] | null
          metadata_fields?: Json | null
          name: string
          pm_template_ids?: string[] | null
          sla_priority?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          inspection_template_ids?: string[] | null
          metadata_fields?: Json | null
          name?: string
          pm_template_ids?: string[] | null
          sla_priority?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          amc_contract_no: string | null
          amc_end_date: string | null
          amc_start_date: string | null
          category_supplied: string | null
          code: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          has_amc: boolean | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          amc_contract_no?: string | null
          amc_end_date?: string | null
          amc_start_date?: string | null
          category_supplied?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          has_amc?: boolean | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          amc_contract_no?: string | null
          amc_end_date?: string | null
          amc_start_date?: string | null
          category_supplied?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          has_amc?: boolean | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          asset_id: string | null
          assigned_technician_id: string | null
          assigned_technician_name: string | null
          checklist_responses: Json | null
          checklist_snapshot: Json | null
          checklist_template_id: string | null
          completed_at: string | null
          completion_photo_url: string | null
          created_at: string
          due_date: string
          executed_by: string | null
          frequency: string | null
          id: string
          issue_logged: string | null
          parts_replaced: Json | null
          priority: string | null
          room_id: string | null
          solution_taken: string | null
          source: string | null
          source_ref_id: string | null
          start_photo_url: string | null
          status: string | null
          technician_remarks: string | null
          title: string
          type: string
          vendor_cost: number | null
          vendor_id: string | null
          vendor_job_sheet_url: string | null
          vendor_remarks: string | null
          vendor_service_date: string | null
          vendor_tech_name: string | null
          vendor_tech_phone: string | null
          vendor_ticket_no: string | null
          wo_number: string
        }
        Insert: {
          asset_id?: string | null
          assigned_technician_id?: string | null
          assigned_technician_name?: string | null
          checklist_responses?: Json | null
          checklist_snapshot?: Json | null
          checklist_template_id?: string | null
          completed_at?: string | null
          completion_photo_url?: string | null
          created_at: string
          due_date: string
          executed_by?: string | null
          frequency?: string | null
          id?: string
          issue_logged?: string | null
          parts_replaced?: Json | null
          priority?: string | null
          room_id?: string | null
          solution_taken?: string | null
          source?: string | null
          source_ref_id?: string | null
          start_photo_url?: string | null
          status?: string | null
          technician_remarks?: string | null
          title: string
          type: string
          vendor_cost?: number | null
          vendor_id?: string | null
          vendor_job_sheet_url?: string | null
          vendor_remarks?: string | null
          vendor_service_date?: string | null
          vendor_tech_name?: string | null
          vendor_tech_phone?: string | null
          vendor_ticket_no?: string | null
          wo_number: string
        }
        Update: {
          asset_id?: string | null
          assigned_technician_id?: string | null
          assigned_technician_name?: string | null
          checklist_responses?: Json | null
          checklist_snapshot?: Json | null
          checklist_template_id?: string | null
          completed_at?: string | null
          completion_photo_url?: string | null
          created_at?: string
          due_date?: string
          executed_by?: string | null
          frequency?: string | null
          id?: string
          issue_logged?: string | null
          parts_replaced?: Json | null
          priority?: string | null
          room_id?: string | null
          solution_taken?: string | null
          source?: string | null
          source_ref_id?: string | null
          start_photo_url?: string | null
          status?: string | null
          technician_remarks?: string | null
          title?: string
          type?: string
          vendor_cost?: number | null
          vendor_id?: string | null
          vendor_job_sheet_url?: string | null
          vendor_remarks?: string | null
          vendor_service_date?: string | null
          vendor_tech_name?: string | null
          vendor_tech_phone?: string | null
          vendor_ticket_no?: string | null
          wo_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      room_check_in: {
        Args: {
          p_activity_number: string
          p_check_in_date: string
          p_check_in_time: string
          p_check_in_timestamp: number
          p_id: string
          p_purpose: string
          p_room_id: string
          p_user_name: string
          p_user_role: string
        }
        Returns: undefined
      }
      room_check_out: {
        Args: {
          p_auto_checkout_note?: string
          p_check_out_time: string
          p_check_out_timestamp: number
          p_is_force_checkout?: boolean
          p_room_id: string
        }
        Returns: undefined
      }
      run_auto_checkouts: { Args: never; Returns: undefined }
      set_asset_status: {
        Args: { p_asset_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
