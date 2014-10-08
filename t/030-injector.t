#!/usr/bin/perl

use strict;
use warnings;

use Test::More;
use Test::Fatal;

use Plack::Builder;
   
use Plack::Test::Debugger;   
use HTTP::Request::Common qw[ GET ];
use Path::Class           qw[ dir ];
use Data::Dumper          qw[ Dumper ];

BEGIN {
    use_ok('Plack::Debugger');
    use_ok('Plack::Debugger::Storage');

    use_ok('Plack::App::Debugger');    
}

my $DATA_DIR = dir('./t/tmp/');

# cleanup tmp dir
{ -f $_ && $_->remove foreach $DATA_DIR->children( no_hidden => 1 ) }

my $debugger_application = Plack::App::Debugger->new( 
    debugger => Plack::Debugger->new(
        storage => Plack::Debugger::Storage->new(
            data_dir     => $DATA_DIR,
            # quick and dirty serializer, DO NOT USE THIS FOR REAL!
            serializer   => sub { Dumper( shift ) },
            deserializer => sub { eval( shift )   },
        )
    )
);

my $app = builder {
    mount '/' => builder {
        enable $debugger_application->make_injector_middleware;
        enable $debugger_application->debugger->make_collector_middleware;

        sub {
            my $env = shift;
            [ 
                200, 
                [ 
                    'Content-Type'   => 'text/html',
                    'Content-Length' => 37
                ], 
                [ '<html><body>HELLO WORLD</body></html>' ]
            ]
        };
    }
};

test_psgi($app, sub {
        my $cb  = shift;
        {
            my $resp = $cb->(GET '/');  
            is($resp->code, 200, '... got the status (200) we expected');
            isnt($resp->headers->header('Content-Length'), 37, '... got the expected expanded Content-Length');
            like(
                $resp->content, 
                qr!^<html><body>HELLO WORLD(.*)</body></html>$!, 
                '... got the right content'
            );
        }
    }
);

done_testing;







