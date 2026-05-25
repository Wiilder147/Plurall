import os
import re

def get_description(filepath):
    path = filepath.lower()
    if 'api' in path:
        return "Endpoint de API (Backend) para manejar la lógica de " + os.path.basename(os.path.dirname(filepath))
    elif 'components' in path:
        return "Componente de interfaz de usuario (UI) reutilizable."
    elif 'lib' in path:
        return "Módulo de utilidades y funciones compartidas."
    elif 'login' in path:
        return "Vista de inicio de sesión para los usuarios."
    elif 'registro' in path:
        return "Vista de registro de nuevos usuarios."
    elif 'recuperar' in path:
        return "Vista para recuperar la contraseña mediante OTP."
    elif 'dashboard' in path:
        return "Vista del panel de control del usuario."
    elif 'admin' in path:
        return "Vista del panel de administración."
    elif 'asesor' in path:
        return "Vista del panel para el rol de asesor."
    elif 'supervisor' in path:
        return "Vista del panel para el rol de supervisor."
    else:
        return "Archivo principal de la aplicación frontend."

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Si ya tiene un comentario de bloque al inicio, lo saltamos
    if "/* ==========================================================================" in content:
        return

    desc = get_description(filepath)
    comment = f"""/* ==========================================================================
 * ARCHIVO: {os.path.basename(filepath)}
 * RUTA: {filepath.replace('/home/plurall/Documents/Estudio/Plurall/', '')}
 * DESCRIPCIÓN: {desc}
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
"""
    
    # Manejar 'use client'
    if content.startswith("'use client'") or content.startswith('"use client"'):
        lines = content.split('\n')
        new_content = lines[0] + '\n\n' + comment + '\n'.join(lines[1:])
    else:
        new_content = comment + content

    with open(filepath, 'w') as f:
        f.write(new_content)

for root, dirs, files in os.walk('/home/plurall/Documents/Estudio/Plurall/apps/web'):
    if 'node_modules' in root or '.next' in root:
        continue
    for file in files:
        if file.endswith('.js'):
            process_file(os.path.join(root, file))

print("Comentarios agregados exitosamente.")
