#version 140

in mediump vec4 var_color;
in mediump vec3 var_normal;

out vec4 out_fragColor;

uniform fs_uniforms
{
    vec4 tint;
};

void main()
{
    vec4 tint_pm = vec4(tint.rgb * tint.w, tint.w);
    out_fragColor = vec4(var_color.rgb * tint_pm.rgb, 1.0);
}
