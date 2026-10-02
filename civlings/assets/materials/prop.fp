#version 140

in mediump vec4 var_color;
in mediump vec2 var_texcoord;

out vec4 out_fragColor;

uniform fs_uniforms
{
    vec4 tint;
};
uniform sampler2D tex0;

void main()
{
    vec4 tex = texture(tex0, var_texcoord);
    vec4 tint_pm = vec4(tint.rgb * tint.w, tint.w);
    out_fragColor = vec4(tex.rgb * var_color.rgb * tint_pm.rgb, 1.0);
}
