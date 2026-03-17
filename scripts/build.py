"""
index.htmlにCSS/JSを全てインラインで埋め込むビルドスクリプト（化学版）
"""
import os
import re

base = r'G:\マイドライブ\共通テスト化学データベース'

# Read CSS
with open(os.path.join(base, 'index.css'), 'r', encoding='utf-8') as f:
    css = f.read()

# Read JS files in order
js_files = [
    os.path.join(base, 'data', 'registry.js'),
    os.path.join(base, 'data', 'sundai_2025_chem', 'meta.js'),
    os.path.join(base, 'data', 'sundai_2025_chemkiso', 'meta.js'),
    os.path.join(base, 'data', 'sundai_2024_chem', 'meta.js'),
    os.path.join(base, 'data', 'sundai_2024_chemkiso', 'meta.js'),
    os.path.join(base, 'data', 'kakomon_chem', 'meta.js'),
    os.path.join(base, 'data', 'zkai_2026_chem', 'meta.js'),
    os.path.join(base, 'app.js')
]
js_parts = []
for jf in js_files:
    with open(jf, 'r', encoding='utf-8') as f:
        js_parts.append(f'// === {os.path.basename(jf)} ===\n' + f.read())
js_combined = '\n\n'.join(js_parts)

# Build new HTML from scratch
html = f'''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>共通テスト化学データベース</title>
  <meta name="description" content="共通テスト化学の問題を出版社・年度・単元で横断検索し、問題と解説をワンセットで印刷できるWebアプリ">
  <style>
{css}
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="header-inner">
      <div class="logo">
        <span class="logo-icon">🧪</span>
        <span class="logo-text">化学DB</span>
        <span class="logo-sub">共通テスト問題データベース</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-icon" id="themeToggle" onclick="toggleTheme()" title="テーマ切替">🌙</button>
        <button class="btn btn-ghost btn-icon" onclick="openHelp()" title="使い方ガイド">❓</button>
        <button class="btn btn-ghost btn-icon" id="adminToggle" onclick="toggleAdminMode()" title="管理モード">🔧</button>
        <button class="btn btn-ghost btn-icon" id="selectModeBtn" onclick="toggleSelectMode()" title="選択モード">☐</button>
      </div>
    </div>
  </header>

  <!-- Search Section -->
  <section class="search-section no-print">
    <div class="search-inner">
      <div class="filter-row">
        <span class="filter-label">出版社</span>
        <div class="filter-chips" id="publisherFilters"></div>
      </div>
      <div class="filter-row">
        <span class="filter-label">年度</span>
        <div class="filter-chips" id="yearFilters"></div>
      </div>
      <div class="filter-row">
        <span class="filter-label">科目</span>
        <div class="filter-chips" id="subjectFilters"></div>
      </div>
      <div class="filter-row">
        <span class="filter-label">回</span>
        <div class="filter-chips" id="roundFilters"></div>
      </div>

      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" placeholder="タグや単元で検索（例: 酸化還元, 有機化合物, 化学平衡）">
        <button class="clear-btn" id="clearSearch" onclick="clearSearch()">✕</button>
      </div>

      <div class="filter-row">
        <span class="filter-label">単元</span>
        <div class="filter-chips" id="unitFilters"></div>
      </div>
    </div>
  </section>

  <!-- Main -->
  <main class="main-content">
    <div class="stats-bar no-print">
      <span class="stats-text" id="statsText"><strong>0</strong> 件の問題</span>
      <div class="stats-actions">
        <button class="btn btn-secondary btn-icon" onclick="toggleAllSelect()" title="すべて選択/解除">📋</button>
      </div>
    </div>
    <div class="cards-grid" id="cardsGrid"></div>
    <div class="no-results" id="noResults" style="display:none;">
      <div class="no-results-icon">🔍</div>
      <h3>一致する問題が見つかりません</h3>
      <p>検索条件を変更してお試しください</p>
    </div>
  </main>

  <!-- Selection Bar -->
  <div class="selection-bar" id="selectionBar">
    <span class="sel-count" id="selCount">0 件選択中</span>
    <button class="btn btn-primary" onclick="printSelected()">🖨️ 印刷</button>
    <button class="btn btn-secondary" onclick="viewSelected()">👁️ プレビュー</button>
    <button class="btn btn-ghost" onclick="clearSelection()">✕ 解除</button>
  </div>

  <!-- Admin Mode Indicator -->
  <div class="admin-indicator" id="adminIndicator">
    🔧 管理モード — 画像をクリックして差し替え / ドラッグ&amp;ドロップ / Ctrl+Vでペースト
  </div>

  <!-- Modal: Question Viewer -->
  <div class="modal-overlay" id="viewerModal">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title" id="modalTitle"></div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-footer">
        <div class="view-tabs">
          <button class="view-tab active" data-view="pair" onclick="switchView('pair')">📖 問題＋解答</button>
          <button class="view-tab" data-view="problem" onclick="switchView('problem')">📝 問題のみ</button>
          <button class="view-tab" data-view="answer" onclick="switchView('answer')">✅ 解答のみ</button>
        </div>
        <button class="btn btn-primary" onclick="printCurrent()">🖨️ 印刷</button>
      </div>
    </div>
  </div>

  <!-- Help Modal -->
  <div class="modal-overlay" id="helpModal" onclick="if(event.target===this)closeHelp()">
    <div class="modal-content" style="max-width:720px">
      <div class="modal-header" style="display:flex!important;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">
        <h2 style="margin:0;font-size:18px;color:var(--text-primary)">📖 使い方ガイド</h2>
        <button class="btn btn-ghost btn-icon" onclick="closeHelp()" style="font-size:20px">✕</button>
      </div>
      <div class="modal-body" style="padding:20px;max-height:70vh;overflow-y:auto;font-size:14px;line-height:1.7;color:var(--text-primary)">
        <h3 style="margin:0 0 8px;font-size:15px;color:var(--text-accent)">🔍 検索・フィルタ</h3>
        <ul style="margin:0 0 16px;padding-left:20px">
          <li><b>出版社・年度・科目・回</b> のチップをクリックで絞り込み</li>
          <li><b>キーワード検索</b>：問題名・タグ・トピック等で自由検索</li>
          <li>複数条件の組み合わせ可能（AND検索）</li>
        </ul>
        <h3 style="margin:0 0 8px;font-size:15px;color:var(--text-accent)">👁️ 問題の閲覧</h3>
        <ul style="margin:0 0 16px;padding-left:20px">
          <li>カードをクリックで問題ビューアを表示</li>
          <li><b>問題＋解答</b>：左右2列で同時表示</li>
          <li><b>問題のみ / 解答のみ</b>：タブで切り替え</li>
          <li>画像クリックで拡大表示</li>
        </ul>
        <h3 style="margin:0 0 8px;font-size:15px;color:var(--text-accent)">☐ 選択モード＆印刷</h3>
        <ul style="margin:0 0 16px;padding-left:20px">
          <li>ヘッダーの <b>☐</b> ボタンで選択モード ON/OFF</li>
          <li>カードをクリックして複数問題を選択</li>
          <li>画面下部のバーから <b>🖨️ 印刷</b> / <b>👁️ プレビュー</b></li>
          <li>各画像が1ページに収まるよう自動縮小されます</li>
          <li>問題と解答・解説は別ページに出力されます</li>
        </ul>
        <h3 style="margin:0 0 8px;font-size:15px;color:var(--text-accent)">🔧 管理モード（画像編集）</h3>
        <ul style="margin:0 0 16px;padding-left:20px">
          <li>ヘッダーの <b>🔧</b> ボタンで管理モード ON/OFF</li>
          <li><b>画像の追加</b>：ドラッグ＆ドロップ / Ctrl+V でペースト</li>
          <li><b>画像の削除</b>：画像上の ✕ ボタン</li>
          <li><b>画像の並替</b>：↑↓ ボタンで順序変更</li>
          <li>変更はブラウザのIndexedDBに自動保存されます</li>
        </ul>
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;padding:12px 16px;margin-top:8px">
          <p style="margin:0;font-size:13px;color:var(--text-muted)">💡 <b>ヒント</b>：ビューア表示中に問題カードの 🖨️ ボタンを押すと、その問題だけを直接印刷できます。</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Print Modal -->
  <div class="modal-overlay" id="printModal">
    <div class="modal-content">
      <div class="print-header" id="printHeader"></div>
      <div class="modal-body" id="printBody"></div>
    </div>
  </div>

  <script>
{js_combined}
  </script>
</body>
</html>
'''

with open(os.path.join(base, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Done. HTML size: {len(html):,} bytes')
