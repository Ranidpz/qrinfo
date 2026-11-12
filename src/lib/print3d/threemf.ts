// 3MF writer for Bambu Studio. A 3MF is a zip of XML: the core spec model (meshes in mm, one object
// per printed piece made of parts) + Bambu's Metadata/model_settings.config, which tells Bambu Studio
// which filament each part uses so nothing has to be assigned by hand.
import { zipSync, strToU8 } from 'fflate';
import type { Mesh } from './mesh';

export interface Part { name: string; mesh: Mesh; filament: number }   // filament: 1-based slot in the project
export interface PrintObject { name: string; parts: Part[]; x: number; y: number }

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="config" ContentType="text/xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function meshXml(mesh: Mesh, out: string[]): void {
  out.push('<mesh><vertices>');
  const v = mesh.v;
  for (let i = 0; i < v.length; i += 3) out.push(`<vertex x="${f(v[i])}" y="${f(v[i + 1])}" z="${f(v[i + 2])}"/>`);
  out.push('</vertices><triangles>');
  const t = mesh.t;
  for (let i = 0; i < t.length; i += 3) out.push(`<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>`);
  out.push('</triangles></mesh>');
}

export function make3mf(objects: PrintObject[], opts: { title: string }): Uint8Array {
  const model: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    `<metadata name="Title">${esc(opts.title)}</metadata>`,
    '<metadata name="Application">The Q (qr.playzones.app)</metadata>',
    '<resources>',
  ];
  const settings: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>'];
  const build: string[] = ['<build>'];
  const plate: string[] = ['<plate>', '<metadata key="plater_id" value="1"/>', '<metadata key="plater_name" value=""/>', '<metadata key="locked" value="false"/>'];

  let id = 1;
  for (const obj of objects) {
    const partIds: number[] = [];
    for (const p of obj.parts) {
      model.push(`<object id="${id}" name="${esc(p.name)}" type="model">`);
      meshXml(p.mesh, model);
      model.push('</object>');
      partIds.push(id++);
    }
    const objId = id++;
    model.push(`<object id="${objId}" name="${esc(obj.name)}" type="model"><components>`);
    for (const pid of partIds) model.push(`<component objectid="${pid}"/>`);
    model.push('</components></object>');
    build.push(`<item objectid="${objId}" transform="1 0 0 0 1 0 0 0 1 ${f(obj.x)} ${f(obj.y)} 0" printable="1"/>`);

    settings.push(`<object id="${objId}">`, `<metadata key="name" value="${esc(obj.name)}"/>`, `<metadata key="extruder" value="${obj.parts[0]?.filament ?? 1}"/>`);
    obj.parts.forEach((p, i) => {
      settings.push(
        `<part id="${partIds[i]}" subtype="normal_part">`,
        `<metadata key="name" value="${esc(p.name)}"/>`,
        '<metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>',
        `<metadata key="extruder" value="${p.filament}"/>`,
        '</part>',
      );
    });
    settings.push('</object>');
    plate.push('<model_instance>', `<metadata key="object_id" value="${objId}"/>`, '<metadata key="instance_id" value="0"/>', '</model_instance>');
  }
  model.push('</resources>', ...build, '</build>', '</model>');
  plate.push('</plate>');
  settings.push(...plate, '</config>');

  return zipSync(
    {
      '[Content_Types].xml': strToU8(CONTENT_TYPES),
      '_rels/.rels': strToU8(RELS),
      '3D/3dmodel.model': strToU8(model.join('')),
      'Metadata/model_settings.config': strToU8(settings.join('\n')),
    },
    { level: 6 },
  );
}
