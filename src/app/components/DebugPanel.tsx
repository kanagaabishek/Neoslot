"use client"

import React, { useState } from 'react';

interface DebugPanelProps {
  logs: string[];
  isVisible: boolean;
  onToggle: () => void;
  onClear: () => void;
}

export default function DebugPanel({ logs, isVisible, onToggle, onClear }: DebugPanelProps) {
  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4">
        <button
          onClick={onToggle}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-slate-700 transition-colors"
        >
          Show Debug
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-slate-900 text-emerald-400 rounded-lg shadow-xl border border-slate-700">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <h3 className="text-sm font-medium text-white">Debug Console</h3>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onToggle}
            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
          >
            Hide
          </button>
        </div>
      </div>
      <div className="p-3 max-h-64 overflow-y-auto text-xs font-mono">
        {logs.length === 0 ? (
          <div className="text-slate-500">No debug logs yet...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1 break-words">
              <span className="text-slate-500 mr-2">
                {new Date().toLocaleTimeString()}
              </span>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
