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
          className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700"
        >
          Show Debug
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-gray-900 text-green-400 rounded-lg shadow-xl border border-gray-700">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-white">Debug Console</h3>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Clear
          </button>
          <button
            onClick={onToggle}
            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            Hide
          </button>
        </div>
      </div>
      <div className="p-3 max-h-64 overflow-y-auto text-xs font-mono">
        {logs.length === 0 ? (
          <div className="text-gray-500">No debug logs yet...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1 break-words">
              <span className="text-gray-500 mr-2">
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
