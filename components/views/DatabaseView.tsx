'use client';

import React, { useState, useEffect } from 'react';
import { 
  Database, Table, Rows, Columns, RefreshCw, Copy, Check, Search, Eye 
} from 'lucide-react';

interface TableMeta {
  table_name: string;
  estimated_rows: string | number;
  columns_count: string | number;
}

interface ColumnMeta {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export function DatabaseView() {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('profiles');
  const [tableData, setTableData] = useState<{ columns: ColumnMeta[]; rows: Record<string, unknown>[] } | null>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [searchTable, setSearchTable] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchTables = async () => {
    setLoadingTables(true);
    try {
      const res = await fetch('/api/admin/database');
      const data = await res.json();
      if (data.success) {
        setTables(data.tables || []);
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchTableData = async (table: string) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/admin/database?table=${table}`);
      const data = await res.json();
      if (data.success) {
        setTableData({
          columns: data.columns || [],
          rows: data.rows || [],
        });
      }
    } catch (err) {
      console.error('Failed to load table data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable]);

  const copyJson = () => {
    if (!tableData) return;
    navigator.clipboard.writeText(JSON.stringify(tableData.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTables = tables.filter((t) =>
    t.table_name.toLowerCase().includes(searchTable.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">0–100 PostgreSQL Database Explorer</h2>
            <p className="text-xs text-slate-400">
              Live inspection of public tables, row counts, column schemas, and raw data dumps
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchTables();
            if (selectedTable) fetchTableData(selectedTable);
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Refresh DB</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Tables List */}
        <div className="p-4 rounded-3xl bg-slate-950/60 border border-slate-800 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-bold font-mono uppercase text-slate-400">Public Tables</span>
            <span className="text-xs font-mono text-cyan-400 font-bold">{tables.length}</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter table name..."
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[600px] pr-1">
            {loadingTables ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading tables...</div>
            ) : (
              filteredTables.map((t) => (
                <button
                  key={t.table_name}
                  onClick={() => setSelectedTable(t.table_name)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                    selectedTable === t.table_name
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-bold shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <span className="truncate">{t.table_name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 font-normal ml-2">
                    {t.columns_count} cols
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Live Data & Schema Viewer */}
        <div className="lg:col-span-3 p-6 rounded-3xl bg-slate-950/60 border border-slate-800 flex flex-col space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white font-mono">
                  public.{selectedTable}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                  {tableData?.rows?.length || 0} sample rows
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Schema: {tableData?.columns?.length || 0} verified columns
              </p>
            </div>

            <button
              onClick={copyJson}
              disabled={!tableData?.rows?.length}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Rows' : 'Copy Rows JSON'}</span>
            </button>
          </div>

          {loadingData ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Querying PostgreSQL table...</span>
            </div>
          ) : !tableData || tableData.rows.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
              No rows recorded in this table yet.
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Columns Header Summary */}
              <div className="flex flex-wrap gap-1.5">
                {tableData.columns.map((col) => (
                  <span
                    key={col.column_name}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300"
                  >
                    <span className="text-cyan-400 font-bold">{col.column_name}</span>:{' '}
                    <span className="text-slate-500">{col.data_type}</span>
                  </span>
                ))}
              </div>

              {/* Rows Table */}
              <div className="overflow-x-auto max-h-[500px] border border-slate-800 rounded-2xl">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                    <tr>
                      {tableData.columns.slice(0, 8).map((c) => (
                        <th key={c.column_name} className="py-2.5 px-3 whitespace-nowrap">
                          {c.column_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-black/40">
                    {tableData.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                        {tableData.columns.slice(0, 8).map((c) => {
                          const val = row[c.column_name];
                          const str = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? 'null');
                          return (
                            <td key={c.column_name} className="py-2.5 px-3 max-w-[200px] truncate text-slate-300">
                              {str}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
