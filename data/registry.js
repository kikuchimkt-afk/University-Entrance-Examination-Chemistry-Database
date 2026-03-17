// =============================================================================
// 共通テスト化学データベース - 問題集レジストリ
// =============================================================================

var BOOK_REGISTRY = [
  {
    id: "sundai_2025_chem",
    publisher: "駿台",
    year: 2025,
    subject: "化学",
    title: "2025年 駿台実戦問題集 化学",
    dataPath: "data/sundai_2025_chem/meta.js",
    enabled: true
  },
  {
    id: "sundai_2025_chemkiso",
    publisher: "駿台",
    year: 2025,
    subject: "化学基礎",
    title: "2025年 駿台実戦問題集 化学基礎",
    dataPath: "data/sundai_2025_chemkiso/meta.js",
    enabled: true
  },
  {
    id: "sundai_2024_chem",
    publisher: "駿台",
    year: 2024,
    subject: "化学",
    title: "2024年 駿台実戦問題集 化学",
    dataPath: "data/sundai_2024_chem/meta.js",
    enabled: true
  },
  {
    id: "sundai_2024_chemkiso",
    publisher: "駿台",
    year: 2024,
    subject: "化学基礎",
    title: "2024年 駿台実戦問題集 化学基礎",
    dataPath: "data/sundai_2024_chemkiso/meta.js",
    enabled: true
  },
  {
    id: "kakomon_chem_2024",
    publisher: "過去問",
    year: 2024,
    subject: "化学",
    title: "2024年度 共通テスト過去問 化学",
    dataPath: "data/kakomon_chem/meta.js",
    enabled: true
  },
  {
    id: "kakomon_chem_2025",
    publisher: "過去問",
    year: 2025,
    subject: "化学",
    title: "2025年度 共通テスト過去問 化学",
    dataPath: "data/kakomon_chem/meta.js",
    enabled: true
  },
  {
    id: "zkai_2026_chem",
    publisher: "Z会",
    year: 2026,
    subject: "化学",
    title: "2026年 Z会共通テスト実戦模試 化学",
    dataPath: "data/zkai_2026_chem/meta.js",
    enabled: true
  }
];

// 出版社カラーテーマ
var PUBLISHER_THEMES = {
  "駿台": { color: "#10b981", bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", icon: "🟢" },
  "Z会":  { color: "#3b82f6", bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", icon: "🔵" },
  "河合塾": { color: "#ef4444", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", icon: "🔴" },
  "東進": { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", icon: "🟡" },
  "代ゼミ": { color: "#8b5cf6", bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)", icon: "🟣" },
  "過去問": { color: "#d97706", bg: "rgba(217,119,6,0.15)", border: "rgba(217,119,6,0.3)", icon: "⭐" }
};

// 科目一覧
var SUBJECTS = ["化学", "化学基礎"];

// 単元カテゴリ分類（共通テスト化学の主要分野）
var TAG_CATEGORIES = {
  "物質の構成": { color: "#6366f1", icon: "⚛️" },
  "物質の変化": { color: "#8b5cf6", icon: "🔥" },
  "無機物質": { color: "#14b8a6", icon: "🪨" },
  "有機化合物": { color: "#22c55e", icon: "🧪" },
  "高分子化合物": { color: "#f97316", icon: "🔬" },
  "化学反応とエネルギー": { color: "#ef4444", icon: "⚡" },
  "反応速度と化学平衡": { color: "#ec4899", icon: "⚖️" },
  "酸と塩基": { color: "#3b82f6", icon: "💧" },
  "酸化還元": { color: "#f59e0b", icon: "🔋" },
  "気体の法則": { color: "#06b6d4", icon: "💨" },
  "溶液の性質": { color: "#a855f7", icon: "🫧" },
  "結晶構造": { color: "#64748b", icon: "💎" }
};
