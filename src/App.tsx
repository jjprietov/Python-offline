/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-python';
import { 
  Play, 
  RotateCcw, 
  Save, 
  Upload, 
  Terminal, 
  Sun, 
  Moon, 
  GripVertical,
  Trash2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { PythonLogo } from './components/PythonLogo';
import { useOnlineStatus } from './hooks/useOnlineStatus';

// @ts-ignore
import Sk from 'skulpt';

const DEFAULT_CODE = "";

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();

  // Send quit beacon to offline executable microserver on window close
  useEffect(() => {
    const handleUnload = () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/quit');
        }
      } catch {}
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // Theme management (Dark / Light) - Starts in Dark mode by default
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      localStorage.removeItem('python-ide-theme');
      const saved = localStorage.getItem('python-ide-theme-v2');
      if (saved === 'light') return 'light';
      return 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('python-ide-theme-v2', theme);
    } catch {}
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Resizable split state (centered at 50% initially)
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const startDragging = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const newPercent = (relativeX / rect.width) * 100;
      // Clamp between 20% and 80% so both editor and console remain comfortable to use
      setSplitPercent(Math.min(Math.max(newPercent, 20), 80));
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const stopDragging = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopDragging);
    };
  }, [isDragging]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const [isInputNeeded, setIsInputNeeded] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const inputResolveRef = useRef<((value: string) => void) | null>(null);
  const [inputValue, setInputValue] = useState('');

  // Configure Skulpt
  useEffect(() => {
    Sk.configure({
      output: (text: string) => {
        setOutput(prev => [...prev, text]);
      },
      read: (x: string) => {
        if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) {
          throw `File not found: '${x}'`;
        }
        return Sk.builtinFiles["files"][x];
      },
      inputfun: (prompt: string) => {
        return new Promise((resolve) => {
          setIsInputNeeded(true);
          setInputPrompt(prompt);
          inputResolveRef.current = resolve;
        });
      },
      inputfunTakesPrompt: true,
      __future__: Sk.python3
    });
  }, []);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputResolveRef.current) {
      const val = inputValue;
      setOutput(prev => [...prev, `${inputPrompt}${val}\n`]);
      inputResolveRef.current(val);
      setInputValue('');
      setIsInputNeeded(false);
      inputResolveRef.current = null;
    }
  };

  const runCode = () => {
    if (isRunning) return;
    setIsRunning(true);
    setOutput([]);
    
    const promise = Sk.misceval.asyncToPromise(() => {
      return Sk.importMainWithBody("<stdin>", false, code, true);
    });

    promise.then(
      () => {
        setIsRunning(false);
      },
      (err: any) => {
        const errMsg = err.toString();
        setOutput(prev => [...prev, `\n[ERROR]: ${errMsg}`]);
        setIsRunning(false);
      }
    );
  };

  // Clear only console output
  const handleClearConsole = () => {
    setOutput([]);
  };

  // Clear only code editor window
  const handleClearCode = () => {
    setCode('');
  };

  // Clear both windows (code and console)
  const handleClearAll = () => {
    setCode('');
    setOutput([]);
  };

  const handleSave = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Programa.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCode(content);
      };
      reader.readAsText(file);
    }
  };

  // Helper for line numbers
  const lineNumbers = code.split('\n').map((_, i) => i + 1);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget.querySelector('textarea');
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = code;
      
      // Get the current line
      const before = val.substring(0, start);
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1];
      
      const trimmedLine = currentLine.trim();
      if (trimmedLine.endsWith(':')) {
        // Auto-indent 4 spaces after a colon
        const match = currentLine.match(/^\s*/);
        const indent = match ? match[0] : '';
        const newIndent = '\n' + indent + '    ';
        
        e.preventDefault();
        const newCode = val.substring(0, start) + newIndent + val.substring(end);
        setCode(newCode);
        
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + newIndent.length;
        }, 0);
      } else {
        // Maintain current indentation
        const match = currentLine.match(/^\s*/);
        const indent = match ? match[0] : '';
        if (indent.length > 0) {
          e.preventDefault();
          const newIndent = '\n' + indent;
          const newCode = val.substring(0, start) + newIndent + val.substring(end);
          setCode(newCode);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + newIndent.length;
          }, 0);
        }
      }
    }
  };

  return (
    <div className={cn("flex flex-col h-screen w-full bg-surface text-on-surface font-sans overflow-hidden", theme)} data-theme={theme}>
      {/* Header: Navigation and Controls */}
      <header className="flex items-center justify-between px-6 py-2.5 bg-surface-container-high border-b border-outline shadow-sm z-10 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <PythonLogo className="w-7 h-7 drop-shadow-sm shrink-0" />
            <span className="font-semibold text-lg text-on-surface">
              Intérprete Python 3
            </span>
          </div>
          <div className="h-5 w-[1px] bg-outline-variant"></div>
          <div className="flex space-x-3 text-[10px] uppercase tracking-widest text-on-surface-variant font-mono">
            <div className="flex items-center space-x-1.5" title="Motor Skulpt 100% autónomo">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Modo Offline</span>
            </div>
            <div className="flex items-center space-x-1.5" title={isOnline ? "La aplicación no requiere internet" : "Dispositivo desconectado de internet"}>
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500/80" : "bg-error")}></div>
              <span>{isOnline ? "Sin Internet Requerido" : "Sin Conexión"}</span>
            </div>
          </div>
        </div>

        {/* Botón en la esquina superior derecha para borrar las dos ventanas */}
        <button
          onClick={handleClearAll}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-bright border border-outline hover:border-error/50 text-on-surface hover:text-error transition-all text-xs font-medium cursor-pointer shadow-xs active:scale-95"
          title="Borrar las dos ventanas (código y consola)"
        >
          <Trash2 size={13} className="text-error shrink-0" />
          <span>Borrar ambas ventanas</span>
        </button>
      </header>

      {/* Main Workspace with resizable split */}
      <main 
        ref={workspaceRef}
        className={cn(
          "flex-1 flex overflow-hidden bg-surface-container-low relative",
          isDragging && "select-none cursor-col-resize"
        )}
      >
        {/* Left Pane: Code Editor */}
        <div 
          style={{ width: `${splitPercent}%` }} 
          className="h-full flex flex-col min-w-[220px] overflow-hidden"
        >
          {/* Toolbar above Editor */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-surface-container border-b border-outline shrink-0">
            <div className="flex items-center space-x-2 h-7">
              <div className="px-3 h-full flex items-center bg-surface border-t-2 border-t-primary text-xs text-primary font-mono font-medium rounded-t shadow-xs cursor-default">
                Programa.py
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {/* Botón para cambiar entre modo oscuro y modo claro */}
              <button 
                onClick={toggleTheme}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors text-xs border border-transparent hover:border-outline cursor-pointer"
                title={theme === 'dark' ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                aria-label={theme === 'dark' ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {theme === 'dark' ? (
                  <>
                    <Sun size={14} className="text-amber-400" />
                    <span className="text-[11px] font-sans font-medium">Modo claro</span>
                  </>
                ) : (
                  <>
                    <Moon size={14} className="text-indigo-600" />
                    <span className="text-[11px] font-sans font-medium">Modo oscuro</span>
                  </>
                )}
              </button>

              <div className="w-[1px] h-4 bg-outline-variant mx-0.5"></div>

              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="p-1.5 hover:bg-surface-bright rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Cargar archivo (.py)"
              >
                <Upload size={14} />
              </button>
              <button 
                onClick={handleSave}
                className="p-1.5 hover:bg-surface-bright rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Guardar archivo (Programa.py)"
              >
                <Save size={14} />
              </button>

              {/* Botón para borrar el código con flecha girando hacia atrás */}
              <button 
                onClick={handleClearCode}
                className="p-1.5 hover:bg-surface-bright rounded text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                title="Borrar el código de esta ventana"
              >
                <RotateCcw size={14} />
              </button>

              <div className="w-[1px] h-4 bg-outline-variant mx-0.5"></div>

              <button 
                onClick={runCode}
                disabled={isRunning}
                className={cn(
                  "flex items-center space-x-1.5 bg-primary hover:opacity-90 px-3 py-1 rounded text-xs text-white font-medium transition-all active:scale-95 shadow-sm cursor-pointer",
                  isRunning && "opacity-50 grayscale cursor-not-allowed"
                )}
              >
                <Play size={12} className={cn("fill-current", isRunning && "opacity-50")} />
                <span>{isRunning ? "Ejecutando..." : "Ejecutar Código"}</span>
              </button>
            </div>
          </div>
          
          {/* Code Area */}
          <div className="flex-1 flex bg-surface font-mono text-sm leading-relaxed overflow-hidden relative">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleLoad} 
              accept=".py" 
              className="hidden" 
            />
            {/* Gutter with line numbers */}
            <div className="w-12 bg-surface-container-low text-on-surface-variant py-4 text-right pr-3 border-r border-outline-variant select-none">
              {lineNumbers.map(n => (
                <div key={n} className="h-6 leading-6 text-xs opacity-70">{n}</div>
              ))}
            </div>
            {/* Code Content Area */}
            <div className="flex-1 overflow-auto bg-surface" onKeyDown={handleKeyDown}>
              <Editor
                value={code}
                onValueChange={code => setCode(code)}
                highlight={code => highlight(code, languages.python, 'python')}
                padding={16}
                className="min-h-full focus:outline-none"
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 14,
                }}
                textareaClassName="focus:outline-none caret-primary text-on-surface"
              />
            </div>
          </div>
        </div>

        {/* Resizable Divider (centered by default, draggable horizontally) */}
        <div
          onMouseDown={startDragging}
          onTouchStart={startDragging}
          onDoubleClick={() => setSplitPercent(50)}
          className={cn(
            "relative w-2.5 group cursor-col-resize flex items-center justify-center select-none z-20 shrink-0 transition-colors border-x border-outline/40",
            isDragging ? "bg-primary/50" : "bg-surface-container hover:bg-primary/30"
          )}
          title="Arrastra para redimensionar (Doble clic para centrar al 50%)"
        >
          {/* Grip handle pill */}
          <div className={cn(
            "w-4 h-9 rounded-md bg-surface-container-highest border border-outline flex items-center justify-center shadow-xs pointer-events-none transition-transform group-hover:scale-105",
            isDragging && "ring-2 ring-primary border-primary"
          )}>
            <GripVertical size={11} className="text-on-surface-variant" />
          </div>
        </div>

        {/* Right Pane: Output Console */}
        <div 
          style={{ width: `${100 - splitPercent}%` }} 
          className="h-full flex flex-col bg-surface-container-lowest min-w-[220px] overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-1.5 bg-surface-container border-b border-outline shrink-0">
            <div className="flex items-center space-x-2">
              <Terminal size={13} className="text-primary" />
              <span className="text-[11px] text-on-surface uppercase tracking-wider font-semibold font-mono">Consola de Salida</span>
            </div>
            <button 
              onClick={handleClearConsole}
              className="p-1 hover:bg-surface-bright rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Borrar la consola de salida"
            >
              <RotateCcw size={13} />
            </button>
          </div>
          <div 
            ref={outputRef}
            className="flex-1 p-4 font-mono text-sm overflow-auto relative selection:bg-primary/30"
          >
            <div className="text-on-surface-variant mb-2 opacity-70">Python 3.10.4 (internal, Offline Build)</div>
            <div className="text-primary font-semibold mb-4">&gt;&gt;&gt; Intérprete preparado.</div>
            
            {output.length === 0 && !isInputNeeded ? (
              <div className="text-on-surface-variant italic opacity-40 mt-8 text-center px-4">
                La salida del programa aparecerá aquí una vez presiones "Ejecutar Código".
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-on-surface break-words leading-relaxed font-mono">
                {output.map((line, i) => (
                  <motion.span 
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                  >
                    {line}
                  </motion.span>
                ))}
                {isRunning && !isInputNeeded && (
                  <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 opacity-70" />
                )}
              </pre>
            )}

            {/* Input Overlay */}
            <AnimatePresence>
              {isInputNeeded && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 p-4 rounded-lg bg-surface-container-high border border-primary/40 shadow-xl"
                >
                  <form onSubmit={handleInputSubmit} className="flex flex-col gap-3">
                    <label className="text-[10px] text-primary uppercase font-bold tracking-wider">
                      Esperando entrada (input):
                    </label>
                    <div className="text-xs text-on-surface font-mono">{inputPrompt}</div>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="flex-1 bg-surface border border-outline rounded px-3 py-1.5 text-on-surface focus:outline-none focus:border-primary font-mono text-sm shadow-inner"
                        placeholder="Escribe la respuesta y pulsa Enter..."
                      />
                      <button 
                        type="submit"
                        className="bg-primary text-white px-4 py-1.5 rounded font-bold text-[10px] uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
                      >
                        Enviar
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer (without "ver manual de referencia") */}
      <footer className="h-8 shrink-0 bg-primary flex items-center justify-between px-6 border-t border-primary/30 text-white select-none">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-[11px] font-mono opacity-90">
            <Terminal size={12} />
            <span>Python 3.10 (Skulpt Offline)</span>
          </div>
          <div className="h-3 w-[1px] bg-white/30 hidden sm:block" />
          <div className="text-[10px] font-sans opacity-85 hidden sm:block">
            División: {Math.round(splitPercent)}% / {100 - Math.round(splitPercent)}% (arrastra el divisor para ajustar)
          </div>
        </div>
        <div className="flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest opacity-90 font-mono">
          <span>Líneas: {lineNumbers.length}</span>
          <span className="border-l border-white/20 pl-4">UTF-8</span>
          <span className="border-l border-white/20 pl-4">Tab: 4</span>
        </div>
      </footer>

    </div>
  );
}
