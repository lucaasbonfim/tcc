import api from './api';

export const research = {
  async get(path, options) { return (await api.get(`/research${path}`,options)).data.data; },
  async post(path, data = {}) { return (await api.post(`/research${path}`,data)).data.data; },
  async put(path, data) { return (await api.put(`/research${path}`,data)).data.data; },
  async upload(projectId, file) {
    return (await api.post(`/research/projects/${projectId}/documents`,file,{
      headers:{'Content-Type':file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain','X-File-Name':encodeURIComponent(file.name)},
    })).data.data;
  },
  async download(path, filename) {
    const response = await api.get(`/research${path}`,{responseType:'blob'});
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href=url; link.download=filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  },
};
