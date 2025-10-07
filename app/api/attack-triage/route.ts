import { NextRequest, NextResponse } from 'next/server';

interface AttackCombination {
  id: string;
  listA: {
    name: string;
    server: string;
    source: string[];
  };
  listB: {
    name: string;
    server: string;
    source: string[];
  };
  listC: {
    name: string;
    server: string;
    sink: string[];
  };
  cvss_score: number;
  cvss_vector: string;
  confidentiality: string;
  risk_level: string;
  description: string;
}

// Predefined 72 attack vector combinations with varying CVSS scores
const predefinedAttackCombinations: AttackCombination[] = [
  // CRITICAL Risk (9.0+) - 8 combinations
  {
    id: "critical_001",
    listA: { name: "get_sensitive_data", server: "github-remote", source: ["external_api", "third_party"] },
    listB: { name: "access_private_repo", server: "github-remote", source: ["private_repo", "confidential"] },
    listC: { name: "send_to_public", server: "jira-tools", sink: ["public_repo", "external_service"] },
    cvss_score: 9.8,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "CRITICAL",
    description: "Critical data exfiltration via public channels"
  },
  {
    id: "critical_002",
    listA: { name: "fetch_external_config", server: "jira-tools", source: ["external_config", "remote_api"] },
    listB: { name: "read_secret_keys", server: "github-remote", source: ["private_repo", "secrets"] },
    listC: { name: "upload_to_cloud", server: "github-remote", sink: ["public_repo", "cloud_storage"] },
    cvss_score: 9.6,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "CRITICAL",
    description: "Secret key exposure through cloud upload"
  },
  {
    id: "critical_003",
    listA: { name: "read_user_input", server: "github-remote", source: ["user_input", "external_form"] },
    listB: { name: "access_database", server: "jira-tools", source: ["private_db", "confidential"] },
    listC: { name: "post_to_webhook", server: "github-remote", sink: ["external_webhook", "public_api"] },
    cvss_score: 9.4,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "CRITICAL",
    description: "Database leak via webhook transmission"
  },
  {
    id: "critical_004",
    listA: { name: "parse_xml_data", server: "jira-tools", source: ["external_xml", "untrusted_input"] },
    listB: { name: "read_env_vars", server: "github-remote", source: ["environment", "secrets"] },
    listC: { name: "send_email", server: "jira-tools", sink: ["email", "external_recipient"] },
    cvss_score: 9.2,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "CRITICAL",
    description: "Environment variable leakage via email"
  },
  {
    id: "critical_005",
    listA: { name: "import_csv", server: "github-remote", source: ["csv_file", "external_data"] },
    listB: { name: "query_private_api", server: "jira-tools", source: ["private_api", "internal"] },
    listC: { name: "create_public_issue", server: "github-remote", sink: ["public_repo", "issue_tracker"] },
    cvss_score: 9.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "CRITICAL",
    description: "Private API data exposed in public issues"
  },
  {
    id: "critical_006",
    listA: { name: "load_remote_config", server: "jira-tools", source: ["remote_config", "external"] },
    listB: { name: "access_user_data", server: "github-remote", source: ["user_profile", "personal"] },
    listC: { name: "log_to_service", server: "jira-tools", sink: ["logging_service", "external"] },
    cvss_score: 9.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "CRITICAL",
    description: "User data logging to external service"
  },
  {
    id: "critical_007",
    listA: { name: "fetch_api_response", server: "github-remote", source: ["api_response", "third_party"] },
    listB: { name: "read_config_file", server: "jira-tools", source: ["config_file", "sensitive"] },
    listC: { name: "push_to_repo", server: "github-remote", sink: ["public_repo", "version_control"] },
    cvss_score: 9.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "CRITICAL",
    description: "Configuration exposure via repository push"
  },
  {
    id: "critical_008",
    listA: { name: "process_webhook", server: "jira-tools", source: ["webhook_data", "external"] },
    listB: { name: "access_credentials", server: "github-remote", source: ["credentials", "secrets"] },
    listC: { name: "update_wiki", server: "jira-tools", sink: ["wiki", "public_documentation"] },
    cvss_score: 9.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "CRITICAL",
    description: "Credential exposure in public documentation"
  },

  // HIGH Risk (7.0-8.9) - 16 combinations
  {
    id: "high_001",
    listA: { name: "read_file_upload", server: "github-remote", source: ["file_upload", "user_content"] },
    listB: { name: "get_project_data", server: "jira-tools", source: ["project_data", "internal"] },
    listC: { name: "create_comment", server: "github-remote", sink: ["public_comment", "visible"] },
    cvss_score: 8.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Project data leak via public comments"
  },
  {
    id: "high_002",
    listA: { name: "parse_json", server: "jira-tools", source: ["json_input", "external"] },
    listB: { name: "read_team_info", server: "github-remote", source: ["team_data", "private"] },
    listC: { name: "send_notification", server: "jira-tools", sink: ["notification", "external"] },
    cvss_score: 8.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Team information disclosed via notifications"
  },
  {
    id: "high_003",
    listA: { name: "import_data", server: "github-remote", source: ["imported_data", "external"] },
    listB: { name: "access_billing", server: "jira-tools", source: ["billing_data", "financial"] },
    listC: { name: "generate_report", server: "github-remote", sink: ["report", "shared"] },
    cvss_score: 8.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Billing data exposure in shared reports"
  },
  {
    id: "high_004",
    listA: { name: "fetch_url_content", server: "jira-tools", source: ["url_content", "remote"] },
    listB: { name: "get_user_profile", server: "github-remote", source: ["user_profile", "personal"] },
    listC: { name: "post_status", server: "jira-tools", sink: ["status_update", "public"] },
    cvss_score: 8.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "User profile leak via status updates"
  },
  {
    id: "high_005",
    listA: { name: "load_template", server: "github-remote", source: ["template", "external"] },
    listB: { name: "read_analytics", server: "jira-tools", source: ["analytics", "metrics"] },
    listC: { name: "create_ticket", server: "github-remote", sink: ["ticket", "support"] },
    cvss_score: 8.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Analytics data exposed in support tickets"
  },
  {
    id: "high_006",
    listA: { name: "process_form", server: "jira-tools", source: ["form_data", "user_input"] },
    listB: { name: "access_logs", server: "github-remote", source: ["access_logs", "audit"] },
    listC: { name: "upload_file", server: "jira-tools", sink: ["file_share", "public"] },
    cvss_score: 7.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Access log exposure via file sharing"
  },
  {
    id: "high_007",
    listA: { name: "read_message", server: "github-remote", source: ["message", "communication"] },
    listB: { name: "get_session_data", server: "jira-tools", source: ["session", "active"] },
    listC: { name: "send_alert", server: "github-remote", sink: ["alert", "broadcast"] },
    cvss_score: 7.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Session data leaked via alert broadcasts"
  },
  {
    id: "high_008",
    listA: { name: "scan_input", server: "jira-tools", source: ["scanned_input", "external"] },
    listB: { name: "read_permissions", server: "github-remote", source: ["permissions", "access_control"] },
    listC: { name: "publish_data", server: "jira-tools", sink: ["published", "open"] },
    cvss_score: 7.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Permission data published openly"
  },
  {
    id: "high_009",
    listA: { name: "validate_input", server: "github-remote", source: ["validation", "input"] },
    listB: { name: "get_cache_data", server: "jira-tools", source: ["cache", "temporary"] },
    listC: { name: "sync_external", server: "github-remote", sink: ["external_sync", "third_party"] },
    cvss_score: 7.4,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Cache data synchronized to third parties"
  },
  {
    id: "high_010",
    listA: { name: "extract_metadata", server: "jira-tools", source: ["metadata", "extracted"] },
    listB: { name: "read_workflow", server: "github-remote", source: ["workflow", "process"] },
    listC: { name: "create_backup", server: "jira-tools", sink: ["backup", "storage"] },
    cvss_score: 7.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Workflow data included in backups"
  },
  {
    id: "high_011",
    listA: { name: "parse_headers", server: "github-remote", source: ["headers", "request"] },
    listB: { name: "access_history", server: "jira-tools", source: ["history", "activity"] },
    listC: { name: "log_event", server: "github-remote", sink: ["event_log", "monitoring"] },
    cvss_score: 7.2,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Activity history logged for monitoring"
  },
  {
    id: "high_012",
    listA: { name: "decode_payload", server: "jira-tools", source: ["payload", "encoded"] },
    listB: { name: "get_settings", server: "github-remote", source: ["settings", "configuration"] },
    listC: { name: "share_link", server: "jira-tools", sink: ["shared_link", "accessible"] },
    cvss_score: 7.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Settings exposed via shared links"
  },
  {
    id: "high_013",
    listA: { name: "transform_data", server: "github-remote", source: ["transformed", "processed"] },
    listB: { name: "read_tokens", server: "jira-tools", source: ["tokens", "authentication"] },
    listC: { name: "export_csv", server: "github-remote", sink: ["csv_export", "download"] },
    cvss_score: 7.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Authentication tokens in CSV exports"
  },
  {
    id: "high_014",
    listA: { name: "aggregate_metrics", server: "jira-tools", source: ["metrics", "aggregated"] },
    listB: { name: "get_dependencies", server: "github-remote", source: ["dependencies", "packages"] },
    listC: { name: "update_status", server: "jira-tools", sink: ["status", "public"] },
    cvss_score: 7.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Dependency information in status updates"
  },
  {
    id: "high_015",
    listA: { name: "filter_content", server: "github-remote", source: ["filtered", "content"] },
    listB: { name: "access_index", server: "jira-tools", source: ["index", "search"] },
    listC: { name: "generate_feed", server: "github-remote", sink: ["feed", "subscription"] },
    cvss_score: 7.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Search index data in subscription feeds"
  },
  {
    id: "high_016",
    listA: { name: "compile_report", server: "jira-tools", source: ["compiled", "report"] },
    listB: { name: "read_statistics", server: "github-remote", source: ["statistics", "usage"] },
    listC: { name: "broadcast_update", server: "jira-tools", sink: ["broadcast", "wide"] },
    cvss_score: 7.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    confidentiality: "High",
    risk_level: "HIGH",
    description: "Usage statistics in broadcast updates"
  },

  // MEDIUM Risk (4.0-6.9) - 24 combinations
  {
    id: "medium_001",
    listA: { name: "sanitize_input", server: "github-remote", source: ["sanitized", "clean"] },
    listB: { name: "get_metadata", server: "jira-tools", source: ["metadata", "descriptive"] },
    listC: { name: "create_summary", server: "github-remote", sink: ["summary", "overview"] },
    cvss_score: 6.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Metadata exposure in summaries"
  },
  {
    id: "medium_002",
    listA: { name: "normalize_text", server: "jira-tools", source: ["normalized", "text"] },
    listB: { name: "read_preferences", server: "github-remote", source: ["preferences", "user"] },
    listC: { name: "send_digest", server: "jira-tools", sink: ["digest", "email"] },
    cvss_score: 6.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "User preferences in email digests"
  },
  {
    id: "medium_003",
    listA: { name: "format_output", server: "github-remote", source: ["formatted", "output"] },
    listB: { name: "get_categories", server: "jira-tools", source: ["categories", "classification"] },
    listC: { name: "publish_article", server: "github-remote", sink: ["article", "blog"] },
    cvss_score: 6.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Category data in published articles"
  },
  {
    id: "medium_004",
    listA: { name: "compress_data", server: "jira-tools", source: ["compressed", "archived"] },
    listB: { name: "read_labels", server: "github-remote", source: ["labels", "tags"] },
    listC: { name: "create_archive", server: "jira-tools", sink: ["archive", "stored"] },
    cvss_score: 6.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Label information in archives"
  },
  {
    id: "medium_005",
    listA: { name: "encrypt_message", server: "github-remote", source: ["encrypted", "secure"] },
    listB: { name: "get_comments", server: "jira-tools", source: ["comments", "feedback"] },
    listC: { name: "send_message", server: "github-remote", sink: ["message", "communication"] },
    cvss_score: 6.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Comment data in encrypted messages"
  },
  {
    id: "medium_006",
    listA: { name: "hash_content", server: "jira-tools", source: ["hashed", "checksum"] },
    listB: { name: "read_attachments", server: "github-remote", source: ["attachments", "files"] },
    listC: { name: "store_cache", server: "jira-tools", sink: ["cache", "temporary"] },
    cvss_score: 5.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Attachment metadata in cache storage"
  },
  {
    id: "medium_007",
    listA: { name: "validate_schema", server: "github-remote", source: ["schema", "structure"] },
    listB: { name: "get_versions", server: "jira-tools", source: ["versions", "history"] },
    listC: { name: "update_index", server: "github-remote", sink: ["index", "search"] },
    cvss_score: 5.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Version history in search indices"
  },
  {
    id: "medium_008",
    listA: { name: "merge_configs", server: "jira-tools", source: ["merged", "configuration"] },
    listB: { name: "read_branches", server: "github-remote", source: ["branches", "development"] },
    listC: { name: "create_webhook", server: "jira-tools", sink: ["webhook", "callback"] },
    cvss_score: 5.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Branch information via webhooks"
  },
  {
    id: "medium_009",
    listA: { name: "sort_results", server: "github-remote", source: ["sorted", "ordered"] },
    listB: { name: "get_milestones", server: "jira-tools", source: ["milestones", "targets"] },
    listC: { name: "generate_chart", server: "github-remote", sink: ["chart", "visualization"] },
    cvss_score: 5.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Milestone data in visual charts"
  },
  {
    id: "medium_010",
    listA: { name: "batch_process", server: "jira-tools", source: ["batched", "bulk"] },
    listB: { name: "read_issues", server: "github-remote", source: ["issues", "tickets"] },
    listC: { name: "export_data", server: "jira-tools", sink: ["export", "external"] },
    cvss_score: 5.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:H/I:L/A:L",
    confidentiality: "High",
    risk_level: "MEDIUM",
    description: "Issue data in bulk exports"
  },
  {
    id: "medium_011",
    listA: { name: "clean_data", server: "github-remote", source: ["cleaned", "processed"] },
    listB: { name: "get_assignees", server: "jira-tools", source: ["assignees", "responsible"] },
    listC: { name: "send_reminder", server: "github-remote", sink: ["reminder", "notification"] },
    cvss_score: 4.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Assignee information in reminders"
  },
  {
    id: "medium_012",
    listA: { name: "queue_task", server: "jira-tools", source: ["queued", "pending"] },
    listB: { name: "read_status", server: "github-remote", source: ["status", "state"] },
    listC: { name: "log_activity", server: "jira-tools", sink: ["activity_log", "audit"] },
    cvss_score: 4.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Status information in activity logs"
  },
  {
    id: "medium_013",
    listA: { name: "encode_url", server: "github-remote", source: ["encoded", "url"] },
    listB: { name: "get_tags", server: "jira-tools", source: ["tags", "labels"] },
    listC: { name: "create_link", server: "github-remote", sink: ["link", "reference"] },
    cvss_score: 4.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Tag information in generated links"
  },
  {
    id: "medium_014",
    listA: { name: "trim_whitespace", server: "jira-tools", source: ["trimmed", "cleaned"] },
    listB: { name: "read_priorities", server: "github-remote", source: ["priorities", "importance"] },
    listC: { name: "update_dashboard", server: "jira-tools", sink: ["dashboard", "display"] },
    cvss_score: 4.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Priority data on dashboards"
  },
  {
    id: "medium_015",
    listA: { name: "split_string", server: "github-remote", source: ["split", "parsed"] },
    listB: { name: "get_components", server: "jira-tools", source: ["components", "modules"] },
    listC: { name: "save_template", server: "github-remote", sink: ["template", "reusable"] },
    cvss_score: 4.2,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Component data in saved templates"
  },
  {
    id: "medium_016",
    listA: { name: "count_items", server: "jira-tools", source: ["counted", "enumerated"] },
    listB: { name: "read_watchers", server: "github-remote", source: ["watchers", "subscribers"] },
    listC: { name: "generate_stats", server: "jira-tools", sink: ["statistics", "metrics"] },
    cvss_score: 4.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Watcher information in statistics"
  },
  {
    id: "medium_017",
    listA: { name: "flatten_array", server: "github-remote", source: ["flattened", "linear"] },
    listB: { name: "get_fixVersions", server: "jira-tools", source: ["fix_versions", "releases"] },
    listC: { name: "create_calendar", server: "github-remote", sink: ["calendar", "schedule"] },
    cvss_score: 4.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Release information in calendars"
  },
  {
    id: "medium_018",
    listA: { name: "convert_format", server: "jira-tools", source: ["converted", "transformed"] },
    listB: { name: "read_reporters", server: "github-remote", source: ["reporters", "creators"] },
    listC: { name: "send_summary", server: "jira-tools", sink: ["summary", "digest"] },
    cvss_score: 4.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Reporter data in summary digests"
  },
  {
    id: "medium_019",
    listA: { name: "reverse_string", server: "github-remote", source: ["reversed", "mirrored"] },
    listB: { name: "get_resolution", server: "jira-tools", source: ["resolution", "outcome"] },
    listC: { name: "update_wiki", server: "github-remote", sink: ["wiki", "documentation"] },
    cvss_score: 4.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Resolution data in wiki updates"
  },
  {
    id: "medium_020",
    listA: { name: "capitalize_text", server: "jira-tools", source: ["capitalized", "formatted"] },
    listB: { name: "read_progress", server: "github-remote", source: ["progress", "completion"] },
    listC: { name: "create_badge", server: "jira-tools", sink: ["badge", "indicator"] },
    cvss_score: 4.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Progress data in status badges"
  },
  {
    id: "medium_021",
    listA: { name: "escape_html", server: "github-remote", source: ["escaped", "safe"] },
    listB: { name: "get_worklog", server: "jira-tools", source: ["worklog", "time_tracking"] },
    listC: { name: "generate_invoice", server: "github-remote", sink: ["invoice", "billing"] },
    cvss_score: 4.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Work log data in billing invoices"
  },
  {
    id: "medium_022",
    listA: { name: "decode_base64", server: "jira-tools", source: ["decoded", "binary"] },
    listB: { name: "read_sprint", server: "github-remote", source: ["sprint", "iteration"] },
    listC: { name: "update_board", server: "jira-tools", sink: ["board", "kanban"] },
    cvss_score: 4.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Sprint data on project boards"
  },
  {
    id: "medium_023",
    listA: { name: "join_arrays", server: "github-remote", source: ["joined", "concatenated"] },
    listB: { name: "get_epic", server: "jira-tools", source: ["epic", "initiative"] },
    listC: { name: "create_roadmap", server: "github-remote", sink: ["roadmap", "planning"] },
    cvss_score: 4.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Epic information in project roadmaps"
  },
  {
    id: "medium_024",
    listA: { name: "round_numbers", server: "jira-tools", source: ["rounded", "approximated"] },
    listB: { name: "read_estimates", server: "github-remote", source: ["estimates", "time"] },
    listC: { name: "send_forecast", server: "jira-tools", sink: ["forecast", "prediction"] },
    cvss_score: 4.0,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:M/I:L/A:L",
    confidentiality: "Medium",
    risk_level: "MEDIUM",
    description: "Time estimates in project forecasts"
  },

  // LOW Risk (0.1-3.9) - 24 combinations
  {
    id: "low_001",
    listA: { name: "lowercase_text", server: "github-remote", source: ["lowercase", "normalized"] },
    listB: { name: "get_public_info", server: "jira-tools", source: ["public", "open"] },
    listC: { name: "log_info", server: "github-remote", sink: ["info_log", "debug"] },
    cvss_score: 3.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Public information in debug logs"
  },
  {
    id: "low_002",
    listA: { name: "uppercase_text", server: "jira-tools", source: ["uppercase", "formatted"] },
    listB: { name: "read_display_name", server: "github-remote", source: ["display_name", "visible"] },
    listC: { name: "create_tooltip", server: "jira-tools", sink: ["tooltip", "help"] },
    cvss_score: 3.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Display names in interface tooltips"
  },
  {
    id: "low_003",
    listA: { name: "pad_string", server: "github-remote", source: ["padded", "formatted"] },
    listB: { name: "get_type", server: "jira-tools", source: ["type", "category"] },
    listC: { name: "update_label", server: "github-remote", sink: ["label", "ui"] },
    cvss_score: 3.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Type information in UI labels"
  },
  {
    id: "low_004",
    listA: { name: "trim_text", server: "jira-tools", source: ["trimmed", "clean"] },
    listB: { name: "read_description", server: "github-remote", source: ["description", "summary"] },
    listC: { name: "show_popup", server: "jira-tools", sink: ["popup", "modal"] },
    cvss_score: 3.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Description text in popup modals"
  },
  {
    id: "low_005",
    listA: { name: "replace_chars", server: "github-remote", source: ["replaced", "substituted"] },
    listB: { name: "get_title", server: "jira-tools", source: ["title", "heading"] },
    listC: { name: "set_placeholder", server: "github-remote", sink: ["placeholder", "hint"] },
    cvss_score: 3.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Title information as input placeholders"
  },
  {
    id: "low_006",
    listA: { name: "substring_text", server: "jira-tools", source: ["substring", "excerpt"] },
    listB: { name: "read_summary", server: "github-remote", source: ["summary", "brief"] },
    listC: { name: "create_breadcrumb", server: "jira-tools", sink: ["breadcrumb", "navigation"] },
    cvss_score: 2.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Summary data in navigation breadcrumbs"
  },
  {
    id: "low_007",
    listA: { name: "check_length", server: "github-remote", source: ["length", "size"] },
    listB: { name: "get_created_date", server: "jira-tools", source: ["created_date", "timestamp"] },
    listC: { name: "format_date", server: "github-remote", sink: ["formatted_date", "display"] },
    cvss_score: 2.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Creation dates in formatted displays"
  },
  {
    id: "low_008",
    listA: { name: "find_index", server: "jira-tools", source: ["index", "position"] },
    listB: { name: "read_updated_date", server: "github-remote", source: ["updated_date", "modified"] },
    listC: { name: "show_timestamp", server: "jira-tools", sink: ["timestamp", "time"] },
    cvss_score: 2.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Update timestamps in time displays"
  },
  {
    id: "low_009",
    listA: { name: "is_empty", server: "github-remote", source: ["empty_check", "validation"] },
    listB: { name: "get_author", server: "jira-tools", source: ["author", "creator"] },
    listC: { name: "display_credit", server: "github-remote", sink: ["credit", "attribution"] },
    cvss_score: 2.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Author information in content attribution"
  },
  {
    id: "low_010",
    listA: { name: "starts_with", server: "jira-tools", source: ["prefix", "beginning"] },
    listB: { name: "read_id", server: "github-remote", source: ["id", "identifier"] },
    listC: { name: "generate_key", server: "jira-tools", sink: ["key", "reference"] },
    cvss_score: 2.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "ID information in generated keys"
  },
  {
    id: "low_011",
    listA: { name: "ends_with", server: "github-remote", source: ["suffix", "ending"] },
    listB: { name: "get_key", server: "jira-tools", source: ["key", "code"] },
    listC: { name: "create_slug", server: "github-remote", sink: ["slug", "url_friendly"] },
    cvss_score: 1.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Key information in URL slugs"
  },
  {
    id: "low_012",
    listA: { name: "contains_text", server: "jira-tools", source: ["contains", "search"] },
    listB: { name: "read_project", server: "github-remote", source: ["project", "workspace"] },
    listC: { name: "set_context", server: "jira-tools", sink: ["context", "scope"] },
    cvss_score: 1.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Project information in context settings"
  },
  {
    id: "low_013",
    listA: { name: "match_pattern", server: "github-remote", source: ["pattern", "regex"] },
    listB: { name: "get_environment", server: "jira-tools", source: ["environment", "context"] },
    listC: { name: "update_theme", server: "github-remote", sink: ["theme", "appearance"] },
    cvss_score: 1.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Environment data in theme updates"
  },
  {
    id: "low_014",
    listA: { name: "split_by_delimiter", server: "jira-tools", source: ["split", "separated"] },
    listB: { name: "read_platform", server: "github-remote", source: ["platform", "system"] },
    listC: { name: "configure_layout", server: "jira-tools", sink: ["layout", "arrangement"] },
    cvss_score: 1.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Platform information in layout configuration"
  },
  {
    id: "low_015",
    listA: { name: "join_with_separator", server: "github-remote", source: ["joined", "combined"] },
    listB: { name: "get_version", server: "jira-tools", source: ["version", "release"] },
    listC: { name: "show_badge", server: "github-remote", sink: ["badge", "status"] },
    cvss_score: 1.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Version information in status badges"
  },
  {
    id: "low_016",
    listA: { name: "remove_duplicates", server: "jira-tools", source: ["unique", "deduplicated"] },
    listB: { name: "read_locale", server: "github-remote", source: ["locale", "language"] },
    listC: { name: "set_language", server: "jira-tools", sink: ["language", "i18n"] },
    cvss_score: 0.9,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Locale information in language settings"
  },
  {
    id: "low_017",
    listA: { name: "shuffle_array", server: "github-remote", source: ["shuffled", "randomized"] },
    listB: { name: "get_timezone", server: "jira-tools", source: ["timezone", "zone"] },
    listC: { name: "format_time", server: "github-remote", sink: ["formatted_time", "clock"] },
    cvss_score: 0.7,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Timezone data in time formatting"
  },
  {
    id: "low_018",
    listA: { name: "generate_uuid", server: "jira-tools", source: ["uuid", "unique_id"] },
    listB: { name: "read_color", server: "github-remote", source: ["color", "theme"] },
    listC: { name: "apply_style", server: "jira-tools", sink: ["style", "css"] },
    cvss_score: 0.5,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
    confidentiality: "Low",
    risk_level: "LOW",
    description: "Color preferences in style applications"
  },
  {
    id: "low_019",
    listA: { name: "get_random_number", server: "github-remote", source: ["random", "generated"] },
    listB: { name: "read_icon", server: "jira-tools", source: ["icon", "symbol"] },
    listC: { name: "update_favicon", server: "github-remote", sink: ["favicon", "browser_icon"] },
    cvss_score: 0.3,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
    confidentiality: "None",
    risk_level: "LOW",
    description: "Icon information in favicon updates"
  },
  {
    id: "low_020",
    listA: { name: "calculate_hash", server: "jira-tools", source: ["hash", "checksum"] },
    listB: { name: "get_avatar", server: "github-remote", source: ["avatar", "profile_pic"] },
    listC: { name: "cache_image", server: "jira-tools", sink: ["cached_image", "stored"] },
    cvss_score: 0.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
    confidentiality: "None",
    risk_level: "LOW",
    description: "Avatar caching for performance"
  },
  {
    id: "low_021",
    listA: { name: "encode_uri", server: "github-remote", source: ["encoded", "safe_url"] },
    listB: { name: "read_size", server: "jira-tools", source: ["size", "dimensions"] },
    listC: { name: "resize_element", server: "github-remote", sink: ["resized", "scaled"] },
    cvss_score: 0.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
    confidentiality: "None",
    risk_level: "LOW",
    description: "Size information in element resizing"
  },
  {
    id: "low_022",
    listA: { name: "decode_uri", server: "jira-tools", source: ["decoded", "readable"] },
    listB: { name: "get_position", server: "github-remote", source: ["position", "coordinates"] },
    listC: { name: "scroll_to", server: "jira-tools", sink: ["scroll", "navigation"] },
    cvss_score: 0.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
    confidentiality: "None",
    risk_level: "LOW",
    description: "Position data for scroll navigation"
  },
  {
    id: "low_023",
    listA: { name: "format_currency", server: "github-remote", source: ["currency", "money"] },
    listB: { name: "read_count", server: "jira-tools", source: ["count", "number"] },
    listC: { name: "display_counter", server: "github-remote", sink: ["counter", "widget"] },
    cvss_score: 0.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
    confidentiality: "None",
    risk_level: "LOW",
    description: "Count information in display widgets"
  },
  {
    id: "low_024",
    listA: { name: "parse_number", server: "jira-tools", source: ["parsed", "numeric"] },
    listB: { name: "get_order", server: "github-remote", source: ["order", "sequence"] },
    listC: { name: "sort_list", server: "jira-tools", sink: ["sorted", "ordered"] },
    cvss_score: 0.1,
    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
    confidentiality: "None",
    risk_level: "LOW",
    description: "Order information in list sorting"
  }
];

export async function GET(request: NextRequest) {
  try {
    // Return the predefined 72 combinations
    const combinations = predefinedAttackCombinations;
    
    // Sort by CVSS score (highest first)
    combinations.sort((a, b) => b.cvss_score - a.cvss_score);
    
    return NextResponse.json({
      success: true,
      combinations: combinations,
      total_count: combinations.length,
      showing_count: combinations.length
    });
    
  } catch (error) {
    console.error('Error in attack triage API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { status: 500 });
  }
}