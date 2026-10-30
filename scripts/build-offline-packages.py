#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
import zipfile

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.chdir(root_dir)

    print("=== 1. Generando index.html autónomo 100% offline ===")
    subprocess.run(["npx", "vite", "build", "--config", "vite.config.singlefile.ts"], check=True)

    singlefile_html = os.path.join(root_dir, "dist-singlefile", "index.html")
    if not os.path.exists(singlefile_html):
        raise FileNotFoundError("No se encontró dist-singlefile/index.html")

    downloads_dir = os.path.join(root_dir, "public", "downloads")
    os.makedirs(downloads_dir, exist_ok=True)

    ico_path = os.path.join(downloads_dir, "python.ico")
    if not os.path.exists(ico_path):
        raise FileNotFoundError("No se encontró public/downloads/python.ico")

    # Copy singlefile html to downloads
    offline_html_dest = os.path.join(downloads_dir, "Interprete_Python_Offline.html")
    shutil.copyfile(singlefile_html, offline_html_dest)
    print(f"-> Generado: {offline_html_dest} ({os.path.getsize(offline_html_dest) / 1024:.1f} KB)")

    print("\n=== 2. Compilando recurso de Windows con icono de Python ===")
    rc_content = f'''1 ICON "{ico_path}"
100 RCDATA "{singlefile_html}"
101 RCDATA "{ico_path}"
'''
    rc_path = os.path.join(root_dir, "scripts", "resource.rc")
    res_obj = os.path.join(root_dir, "scripts", "resource.o")
    with open(rc_path, "w") as f:
        f.write(rc_content)

    subprocess.run(["x86_64-w64-mingw32-windres", rc_path, "-O", "coff", "-o", res_obj], check=True)

    print("\n=== 3. Compilando ejecutable nativo para Windows (.exe) ===")
    exe_dest = os.path.join(downloads_dir, "Interprete_Python_3.exe")
    launcher_c = os.path.join(root_dir, "scripts", "launcher.c")

    cmd = [
        "x86_64-w64-mingw32-gcc",
        "-O2",
        "-mwindows",
        launcher_c,
        res_obj,
        "-o", exe_dest,
        "-lws2_32",
        "-lshell32"
    ]
    subprocess.run(cmd, check=True)
    print(f"-> Generado ejecutable con icono: {exe_dest} ({os.path.getsize(exe_dest) / 1024:.1f} KB)")

    print("\n=== 4. Creando archivo de instrucciones LEEME_INSTRUCCIONES.txt ===")
    readme_path = os.path.join(downloads_dir, "LEEME_INSTRUCCIONES.txt")
    readme_content = """============================================================
INTÉRPRETE PYTHON 3 - EDICIÓN PORTABLE 100% OFFLINE (USB / PC)
============================================================

¡Esta aplicación está lista para usarse completamente OFFLINE sin internet!

CONTENIDO DEL PAQUETE:
1. Interprete_Python_3.exe
   - Ejecutable directo para Windows (con icono oficial de Python).
   - Doble clic y se abrirá inmediatamente en una ventana de aplicación.
   - NO requiere tener Python instalado en el ordenador.
   - NO requiere permisos de administrador.
   - NO requiere conexión a internet (funciona 100% offline).

2. Interprete_Python_Offline.html
   - Versión autónoma en un único archivo.
   - Puedes abrirlo con doble clic en cualquier navegador (Chrome, Edge, Firefox, Safari)
     en Windows, macOS o Linux sin conexión a internet.

3. python.ico
   - Icono oficial de Python por si quieres crear accesos directos personalizados.

INSTRUCCIONES PARA EXÁMENES O AULAS:
1. Copia el archivo 'Interprete_Python_3.exe' a tu memoria USB o al Escritorio del PC.
2. Desconecta el cable de red o apaga el Wi-Fi si el examen requiere estar desconectado.
3. Haz doble clic sobre 'Interprete_Python_3.exe'.
4. ¡Listo! Escribe tu código, ejecuta con el botón 'Ejecutar Código' y visualiza la salida y entradas interactivas (input).
5. Puedes guardar tus ejercicios con el botón de guardar (.py) directamente a tu memoria USB.

============================================================
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)

    print("\n=== 5. Creando archivo comprimido ZIP para USB ===")
    zip_dest = os.path.join(downloads_dir, "Interprete_Python_USB_Portable.zip")
    with zipfile.ZipFile(zip_dest, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe_dest, arcname="Interprete_Python_3.exe")
        zf.write(offline_html_dest, arcname="Interprete_Python_Offline.html")
        zf.write(readme_path, arcname="LEEME_INSTRUCCIONES.txt")
        zf.write(ico_path, arcname="python.ico")
    
    print(f"-> Generado ZIP portable: {zip_dest} ({os.path.getsize(zip_dest) / 1024:.1f} KB)")
    print("\n¡Todo generado con éxito!")

if __name__ == "__main__":
    main()
