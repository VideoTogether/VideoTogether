FROM python:alpine3.16

COPY . /app
RUN pip install -r /app/requirements.txt
RUN chmod u+x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
