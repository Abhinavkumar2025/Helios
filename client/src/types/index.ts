export type BusStatus = "online" | "offline" | "warning";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "detected" | "investigating" | "dispatched" | "resolved";
export type EventType =
  | "accident"
  | "pothole"
  | "waterlogging"
  | "road_sign"
  | "traffic"
  | "pedestrian"
  | "divider";

export interface GPSPoint {
  lat: number;
  lng: number;
}

export interface Bus {
  id: string;
  route: string;
  status: BusStatus;
  speed: number;
  lat: number;
  lng: number;
  battery: number;
  driver_name: string;
  jetson_status: string;
  jetson_temp: number;
  jetson_cpu: number;
  front_cam_status: string;
  rear_cam_status: string;
  last_seen: string;
}

export interface Incident {
  id: string;
  bus_id: string;
  event_type: EventType;
  confidence: number;
  severity: IncidentSeverity;
  gps: GPSPoint;
  timestamp: string;
  camera: "front" | "rear" | string;
  image_url?: string;
  video_url?: string;
  model: string;
  status: IncidentStatus;
  notes?: string;
  metadata_json?: string;
}

export type SOSStatus =
  | "PENDING"
  | "SENT"
  | "AMBULANCE_DISPATCHED"
  | "POLICE_NOTIFIED"
  | "INVESTIGATING"
  | "RESOLVED";

export interface SOSEvent {
  id: string;
  incident_id: string;
  bus_id: string;
  severity: string;
  status: SOSStatus;
  dispatched_ambulance: boolean;
  notified_police: boolean;
  dispatch_time?: string;
  created_at: string;
  updated_at: string;
  incident?: Incident;
}

export interface AIModelStatus {
  id: string;
  name: string;
  type: string;
  version: string;
  status: "ONLINE" | "OFFLINE" | "TRAINING" | "DEGRADED";
  latency_ms: number;
  requests_count: number;
  avg_confidence: number;
  last_heartbeat: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  category: "critical" | "warning" | "info";
  link?: string;
  read: boolean;
  created_at: string;
}

export interface SummaryStats {
  active_buses: number;
  total_buses: number;
  accidents_today: number;
  potholes_detected: number;
  waterlogging_alerts: number;
  traffic_events: number;
  sos_alerts: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface SeverityCount {
  severity: string;
  count: number;
}

export interface DailyTrend {
  date: string;
  accidents: number;
  potholes: number;
  waterlogging: number;
  traffic: number;
}

export interface AnalyticsSummary {
  summary: SummaryStats;
  by_category: CategoryCount[];
  by_severity: SeverityCount[];
  daily_trends: DailyTrend[];
  top_affected_corridors: { corridor: string; incidents: number; risk_level: string }[];
}

export interface TrafficStatItem {
  timestamp: string;
  corridor: string;
  cars: number;
  bikes: number;
  buses: number;
  trucks: number;
  pedestrians: number;
  density_score: number;
}

export interface TrafficAnalytics {
  live_counts: {
    cars: number;
    bikes: number;
    buses: number;
    trucks: number;
    pedestrians: number;
  };
  hourly_flow: { hour: string; vehicles: number }[];
  corridor_breakdown: TrafficStatItem[];
}

export interface WebSocketEvent<T = any> {
  type:
    | "connection_established"
    | "incident_created"
    | "incident_updated"
    | "bus_created"
    | "bus_updated"
    | "gps_updated"
    | "sos_created"
    | "sos_updated"
    | "model_status_changed"
    | "notification_created";
  data: T;
}
