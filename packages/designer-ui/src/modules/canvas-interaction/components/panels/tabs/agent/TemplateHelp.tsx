/**
 * What the runtime's `AgentTemplateRenderer` supports (vnext#1105), shown
 * under the prompt template. Keep in step with the renderer.
 */
export function TemplateHelp() {
  return (
    <span className="block space-y-0.5">
      <span className="block">
        <code>{'{{ data.x.y }}'}</code> and <code>{'{{ data.items[0].name }}'}</code> read the latest instance data,{' '}
        <code>{'{{ body.x }}'}</code> the transition payload; <code>{'{{ instance.id }}'}</code>,{' '}
        <code>{'{{ instance.key }}'}</code> and <code>{'{{ state }}'}</code> are also available. Type <code>{'{{'}</code> for
        the flow’s data paths.
      </span>
      <span className="block">
        Strings render as is, objects and arrays as JSON, missing paths as empty; property names match case-insensitively.
        Nothing is evaluated as code. The same placeholders work in seed messages and the memory key.
      </span>
    </span>
  );
}
